import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/client';
import { logActivity } from '@/lib/utils/audit-logger';

export const dynamic = 'force-dynamic';

import { batchAssign, allocateReserveStaff, AutoAssignConfig, ReserveAssignment } from '@/lib/algorithms/auto-assignment';
import { createSnapshot } from '@/lib/utils/snapshot-helpers';
import { enrichStaffWithAllowedBuildings } from '@/lib/utils/staff-medical-buildings';
import type {
  Staff,
  ExamSession,
  Assignment,
  Room,
  StaffingRatiosConfig,
  SchedulingConstraintsConfig,
  PeriodFreeStaff,
  StaffAvailabilityPolicy,
} from '@/types/database.types';
import { getPeriodFromTime } from '@/types/database.types';

export async function POST(request: NextRequest) {
  try {
const supabaseAuth = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabaseAuth.auth.getSession();
    const email = session?.user?.email?.toLowerCase();
    if (!session || email !== 'melkhodary@horus.edu.eg') {
      return NextResponse.json({ error: 'Unauthorized Access. Super Administrators only.' }, { status: 403 });
    }

    if (!isSupabaseConfigured() || !supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase is not configured. Please set up your environment variables.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { weekStart, onlyOral, assignmentScope } = body;

    if (!weekStart) {
      return NextResponse.json({ error: 'weekStart is required' }, { status: 400 });
    }

    const startDate = new Date(weekStart);
    const startStr = weekStart.includes('T')
      ? startDate.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
      : weekStart.split('T')[0];

    const [sYear, sMonth, sDay] = startStr.split('-').map(Number);
    const calEndDate = new Date(Date.UTC(sYear, sMonth - 1, sDay + 7));
    const endStr = calEndDate.toISOString().split('T')[0];

    const formattedWeekLabel = startDate.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Africa/Cairo',
    });

    // ── Fetch all required data in parallel ──────────────────────────────
    const [staffResult, periodFreeStaffResult, sessionsResult, existingAssignmentsResult, roomsResult, ratiosSettingResult, constraintsSettingResult, calendarRulesResult, activePeriodResult, activePeriodSettingResult, allowedBuildingsResult] =
      await Promise.all([
        supabaseAdmin.from('staff').select('*').eq('availability_status', 'Available').limit(10000),
        supabaseAdmin.from('period_free_staff').select('*').gte('exam_date', startStr).lt('exam_date', endStr).limit(10000),
        supabaseAdmin.from('exam_sessions')
          .select('*')
          .gte('exam_date', startStr)
          .lt('exam_date', endStr)
          .eq('is_locked', false)
          .limit(10000),
        supabaseAdmin.from('assignments')
          .select('*, exam_sessions!inner(exam_date)')
          .gte('exam_sessions.exam_date', startStr)
          .lt('exam_sessions.exam_date', endStr)
          .limit(10000),
        supabaseAdmin.from('rooms').select('*').limit(10000),
        supabaseAdmin.from('system_settings').select('*').eq('setting_key', 'staffing_ratios').single(),
        supabaseAdmin.from('system_settings').select('*').eq('setting_key', 'scheduling_constraints').single(),
        supabaseAdmin.from('system_settings').select('*').eq('setting_key', 'calendar_rules').single(),
        supabaseAdmin.from('exam_periods').select('*').eq('is_active', true).maybeSingle(),
        supabaseAdmin.from('system_settings').select('*').eq('setting_key', 'active_exam_period').maybeSingle(),
        supabaseAdmin.from('system_settings').select('*').eq('setting_key', 'staff_allowed_buildings').maybeSingle(),
      ]);

    const activePeriod = activePeriodResult.data || activePeriodSettingResult.data?.setting_value || null;

    // Check if current active period is Midterm (or requested scope is midterm)
    const isMidtermOnly = assignmentScope === 'midterm' || activePeriod?.semester_type === 'Midterm' || activePeriod?.period_type === 'midterm';
    const isFinalOnly = !isMidtermOnly && assignmentScope === 'final';
    const isOralOnly = !isMidtermOnly && (assignmentScope === 'oral' || onlyOral);
    const isReserveOnly = assignmentScope === 'reserve';

    if (staffResult.error) throw staffResult.error;
    if (periodFreeStaffResult.error) throw periodFreeStaffResult.error;
    if (sessionsResult.error) throw sessionsResult.error;
    if (existingAssignmentsResult.error) throw existingAssignmentsResult.error;
    if (roomsResult.error) throw roomsResult.error;

    const allowedBuildingsMap = (allowedBuildingsResult?.data?.setting_value as Record<string, string[]>) || {};
    const staff: Staff[] = enrichStaffWithAllowedBuildings(staffResult.data || [], allowedBuildingsMap);
    const periodFreeStaff: PeriodFreeStaff[] = periodFreeStaffResult.data || [];
    const sessions: ExamSession[] = sessionsResult.data || [];
    const existingAssignments: Assignment[] = existingAssignmentsResult.data || [];
    const rooms: Room[] = roomsResult.data || [];

    // ── Load settings from DB (fall back to safe defaults) ──────────────
    const staffingRatios: StaffingRatiosConfig = ratiosSettingResult.data?.setting_value || {
      ranges: [
        { min: 1,  max: 9,    head_supervisors: 1, assistants: 0 },
        { min: 10, max: 30,   head_supervisors: 1, assistants: 1 },
        { min: 31, max: 50,   head_supervisors: 1, assistants: 2 },
        { min: 51, max: 60,   head_supervisors: 1, assistants: 3 },
        { min: 61, max: 9999, head_supervisors: 1, assistants: 4 },
      ],
    };

    const savedConstraints: Partial<SchedulingConstraintsConfig> =
      constraintsSettingResult.data?.setting_value || {};

    const shouldIgnoreStaffDays = body.ignoreStaffAvailableDays !== undefined
      ? Boolean(body.ignoreStaffAvailableDays)
      : (activePeriod?.ignore_staff_working_days ?? savedConstraints.ignore_staff_working_days ?? false);

    const effectiveMaxDaysPerWeek = body.maxDaysPerWeek !== undefined
      ? Number(body.maxDaysPerWeek)
      : (activePeriod?.custom_days_per_week ?? savedConstraints.custom_days_per_week ?? 5);

    const effectiveAvailabilityPolicy: StaffAvailabilityPolicy =
      body.availabilityPolicy ||
      activePeriod?.availability_policy ||
      (shouldIgnoreStaffDays ? 'cap_days_per_week' : (savedConstraints.availability_policy || 'respect_all_off_days'));

    const effectiveEnforceStrictRoles = body.enforceStrictRoles !== undefined
      ? Boolean(body.enforceStrictRoles)
      : (savedConstraints.enforce_strict_roles ?? true);

    const effectiveOralMode = body.oralExamAssignmentMode ||
      activePeriod?.oral_exam_assignment_mode ||
      savedConstraints.oral_exam_assignment_mode ||
      'combined';

    const constraints: SchedulingConstraintsConfig = {
      allow_consecutive_shifts: savedConstraints.allow_consecutive_shifts ?? false,
      consecutive_shifts_policy: body.consecutiveShiftsPolicy ||
        savedConstraints.consecutive_shifts_policy ||
        (savedConstraints.allow_consecutive_shifts ? 'allow' : 'avoid'),
      max_hours_per_week_ft:    savedConstraints.max_hours_per_week_ft    ?? 16,
      max_hours_per_week_pt:    savedConstraints.max_hours_per_week_pt    ?? 8,
      max_hours_per_week_chemist: savedConstraints.max_hours_per_week_chemist ?? 20,
      enforce_strict_roles:     effectiveEnforceStrictRoles,
      max_rooms_per_lecturer:   savedConstraints.max_rooms_per_lecturer   ?? 3,
      max_floors_per_supervisor: body.maxFloorsPerSupervisor !== undefined
        ? Number(body.maxFloorsPerSupervisor)
        : (savedConstraints.max_floors_per_supervisor ?? 2),
      require_committees_supervisors: body.requireCommitteesSupervisors !== undefined
        ? Boolean(body.requireCommitteesSupervisors)
        : (savedConstraints.require_committees_supervisors !== false),
      reserve_supervisors_target: body.reserveSupervisorsTarget !== undefined
        ? Number(body.reserveSupervisorsTarget)
        : (activePeriod?.reserve_supervisors_target ?? savedConstraints.reserve_supervisors_target ?? 3),
      reserve_assistants_target: body.reserveAssistantsTarget !== undefined
        ? Number(body.reserveAssistantsTarget)
        : (activePeriod?.reserve_assistants_target ?? savedConstraints.reserve_assistants_target ?? 3),
      reserve_deprioritize_chemists_p2: body.reserveDeprioritizeChemistsP2 !== undefined
        ? Boolean(body.reserveDeprioritizeChemistsP2)
        : (savedConstraints.reserve_deprioritize_chemists_p2 !== false),
      oral_exam_assignment_mode: effectiveOralMode,
      max_score_delta_from_average: body.maxPeerScoreSpread !== undefined
        ? Number(body.maxPeerScoreSpread)
        : (body.maxScoreDelta !== undefined
          ? Number(body.maxScoreDelta)
          : (savedConstraints.max_score_delta_from_average ?? 3)),
      ignore_working_days_if_specific_dates: savedConstraints.ignore_working_days_if_specific_dates ?? true,
      availability_policy:      effectiveAvailabilityPolicy,
      ignore_staff_working_days: shouldIgnoreStaffDays,
      custom_days_per_week:     effectiveMaxDaysPerWeek,
      max_days_per_week_pt:     body.maxDaysPerWeekPT !== undefined
        ? Number(body.maxDaysPerWeekPT)
        : (savedConstraints.max_days_per_week_pt ?? 3),
      max_daily_shifts:         body.maxDailyShifts !== undefined ? Number(body.maxDailyShifts) : (savedConstraints.max_daily_shifts ?? 2),
      max_weekly_reserves:      body.maxWeeklyReserves !== undefined ? Number(body.maxWeeklyReserves) : (savedConstraints.max_weekly_reserves ?? 2),
    };

    if (sessions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unlocked exam sessions found for this week',
        assignmentsCreated: 0,
        violations: [],
      });
    }

    if (staff.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No available staff members found',
        assignmentsCreated: 0,
        violations: [{ type: 'capacity', message: 'No staff available for assignment' }],
      });
    }

    // ── Run the batch assignment algorithm ───────────────────────────────
    const calendarRules = calendarRulesResult.data?.setting_value || [];
    const config: AutoAssignConfig = {
      ratios: staffingRatios,
      constraints,
      calendarRules,
      availabilityPolicy: effectiveAvailabilityPolicy,
      ignoreStaffAvailableDays: shouldIgnoreStaffDays,
      maxDaysPerWeek: effectiveMaxDaysPerWeek,
      isMidterm: isMidtermOnly,
    };

    // Take snapshot before major assignment
    try {
      await createSnapshot();
    } catch (e) {
      console.warn('Failed to create snapshot before auto-assign', e);
    }

    let allNewAssignments: Assignment[] = [];
    let allViolations: any[] = [];

    // ── Clear existing assignments for the scope to prevent duplicates ──
    if (!isReserveOnly) {
      let sessionsToClear = sessions;
      if (isOralOnly) {
        sessionsToClear = sessions.filter(s => !!s.exam_type?.toLowerCase().includes('oral'));
      } else if (isFinalOnly || isMidtermOnly) {
        sessionsToClear = sessions.filter(s => !s.exam_type?.toLowerCase().includes('oral'));
      }

      const sessionIdsToDelete = sessionsToClear.map(s => s.id);
      
      if (sessionIdsToDelete.length > 0) {
        // Chunk deletions to avoid URL length / query size limits in Supabase
        const chunkSize = 200;
        for (let i = 0; i < sessionIdsToDelete.length; i += chunkSize) {
          const chunk = sessionIdsToDelete.slice(i, i + chunkSize);
          const { error: deleteAssignError } = await supabaseAdmin
            .from('assignments')
            .delete()
            .in('exam_session_id', chunk);
          if (deleteAssignError) throw deleteAssignError;
        }
      }

      // Also clear all reserve staff for the week so they don't block main assignments
      const { error: deleteReserveError } = await supabaseAdmin
        .from('period_free_staff')
        .delete()
        .gte('exam_date', startStr)
        .lt('exam_date', endStr);
      if (deleteReserveError) throw deleteReserveError;
    }

    // Ensure we don't pass the deleted assignments to the algorithm
    const sessionIdsToDeleteSet = new Set(!isReserveOnly ? (isOralOnly ? sessions.filter(s => !!s.exam_type?.toLowerCase().includes('oral')) : (isFinalOnly || isMidtermOnly) ? sessions.filter(s => !s.exam_type?.toLowerCase().includes('oral')) : sessions).map(s => s.id) : []);
    const filteredExistingAssignments = existingAssignments.filter(a => !sessionIdsToDeleteSet.has(a.exam_session_id));

    // Calculate clean starting scores based strictly on active assignments that remain:
    const remainingScoreMap = new Map<string, Set<string>>();
    filteredExistingAssignments.forEach(a => {
      const sess = sessions.find(s => s.id === a.exam_session_id);
      if (sess) {
        if (!remainingScoreMap.has(a.staff_id)) remainingScoreMap.set(a.staff_id, new Set());
        remainingScoreMap.get(a.staff_id)!.add(`${sess.exam_date}_${sess.start_time}`);
      }
    });
    for (const s of staff) {
      s.current_score = remainingScoreMap.get(s.id)?.size || 0;
      s.free_staff_score = 0;
    }

    if (!isReserveOnly) {
      // Pass an empty array for periodFreeStaff since we just deleted them from DB
      const result = batchAssign(
        sessions,
        staff,
        filteredExistingAssignments,
        config,
        rooms,
        [],
        isOralOnly,
        isFinalOnly,
        isMidtermOnly
      );
      allNewAssignments = result.assignments;
      allViolations = result.violations;
    }

    // ── Persist new assignments ──────────────────────────────────────────
    if (allNewAssignments.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('assignments')
        .insert(
          allNewAssignments.map(a => ({
            exam_session_id:  a.exam_session_id,
            staff_id:         a.staff_id,
            role:             a.role,
            is_manual_override: false,
          }))
        );

      if (insertError) throw insertError;

      await logActivity(supabaseAdmin, {
        action: 'AUTO_ASSIGN',
        tableName: 'assignments',
        recordId: allNewAssignments[0]?.exam_session_id || 'auto-assign',
        summary: `Auto-assigned ${allNewAssignments.length} supervisors for week of ${formattedWeekLabel}`,
        userEmail: email || 'melkhodary@horus.edu.eg',
        userRole: 'Super Admin',
      });
    }

    // ── Allocate & Persist Reserve Staff (Period Free Staff) ───────────
    let reserveAssignments: ReserveAssignment[] = [];
    if (!isOralOnly) {
      const currentCombinedAssignments: Assignment[] = [
        ...filteredExistingAssignments,
        ...allNewAssignments,
      ];

      const sessionsForReserves = isMidtermOnly
        ? sessions.filter(s => !s.exam_type?.toLowerCase().includes('oral'))
        : sessions;

      if (sessionsForReserves.length > 0) {
        reserveAssignments = allocateReserveStaff(
          sessionsForReserves,
          staff,
          currentCombinedAssignments,
          config
        );

        if (reserveAssignments.length > 0) {
          const { error: reserveInsertError } = await supabaseAdmin
            .from('period_free_staff')
            .insert(
              reserveAssignments.map(r => ({
                exam_date: r.exam_date,
                period: r.period,
                start_time: r.start_time,
                staff_id: r.staff_id,
                role: r.role,
              }))
            );

          if (reserveInsertError) {
            console.error('Failed to insert reserve staff:', reserveInsertError);
          } else {
            // Update free_staff_score in staff table
            const staffIdsToUpdate = new Set(reserveAssignments.map(r => r.staff_id));
            if (staffIdsToUpdate.size > 0) {
              const { data: allReserves } = await supabaseAdmin
                .from('period_free_staff')
                .select('staff_id')
                .limit(10000);

              const scoreMap = new Map<string, number>();
              if (allReserves) {
                allReserves.forEach(r => {
                  scoreMap.set(r.staff_id, (scoreMap.get(r.staff_id) || 0) + 1);
                });
              }

              const updatePromises = Array.from(staffIdsToUpdate).map(staffId => {
                const newScore = scoreMap.get(staffId) || 0;
                return supabaseAdmin
                  .from('staff')
                  .update({ free_staff_score: newScore })
                  .eq('id', staffId);
              });

              await Promise.all(updatePromises);
            }

            await logActivity(supabaseAdmin, {
              action: 'AUTO_ASSIGN',
              tableName: 'period_free_staff',
              recordId: reserveAssignments[0]?.id || 'auto-assign-reserves',
              summary: `Auto-assigned ${reserveAssignments.length} reserve staff for week of ${formattedWeekLabel}`,
              userEmail: email || 'melkhodary@horus.edu.eg',
              userRole: 'Super Admin',
            });
          }
        }
      }
    }

    // Direct score synchronization for current_score so DB is immediately consistent
    const sessionDateMap = new Map<string, ExamSession>(sessions.map(s => [s.id, s]));
    const allAssignmentsForStats = [...filteredExistingAssignments, ...allNewAssignments];
    const staffRoomScoreMap = new Map<string, Set<string>>();
    allAssignmentsForStats.forEach(a => {
      const sess = sessionDateMap.get(a.exam_session_id);
      if (sess) {
        if (!staffRoomScoreMap.has(a.staff_id)) staffRoomScoreMap.set(a.staff_id, new Set());
        staffRoomScoreMap.get(a.staff_id)!.add(`${sess.exam_date}_${sess.start_time}`);
      }
    });

    const staffIdsToUpdateScore = new Set([
      ...allNewAssignments.map(a => a.staff_id),
      ...filteredExistingAssignments.map(a => a.staff_id),
    ]);

    if (staffIdsToUpdateScore.size > 0) {
      const scorePromises = Array.from(staffIdsToUpdateScore).map(staffId => {
        const score = staffRoomScoreMap.get(staffId)?.size || 0;
        return supabaseAdmin
          .from('staff')
          .update({ current_score: score })
          .eq('id', staffId);
      });
      await Promise.all(scorePromises);
    }

    // Calculate cohort statistics to return to UI for instant fairness display
    const cohortsSummary: Record<string, { min: number; max: number; avg: number; spread: number; count: number }> = {};
    const staffBreakdown = staff.map(s => {
      const roomScore = staffRoomScoreMap.get(s.id)?.size || 0;
      const resCount = reserveAssignments.filter(r => r.staff_id === s.id).length;
      const totalScore = roomScore + (resCount * 0.25);
      const cohort = s.job_title || s.supervision_role || 'General';
      const isActive = s.availability_status === 'Available' && (s.working_days?.length || 0) > 0;
      return {
        id: s.id,
        name: s.name,
        cohort,
        supervision_role: s.supervision_role,
        roomScore,
        reserveCount: resCount,
        totalScore,
        isActive,
      };
    });

    for (const s of staffBreakdown) {
      if (!s.isActive) continue;
      if (!cohortsSummary[s.cohort]) {
        cohortsSummary[s.cohort] = { min: Infinity, max: -Infinity, avg: 0, spread: 0, count: 0 };
      }
      const c = cohortsSummary[s.cohort];
      c.count++;
      c.min = Math.min(c.min, s.totalScore);
      c.max = Math.max(c.max, s.totalScore);
      c.avg += s.totalScore;
    }

    for (const c of Object.values(cohortsSummary)) {
      if (c.count > 0) {
        c.avg = Number((c.avg / c.count).toFixed(2));
        c.spread = Number((c.max - c.min).toFixed(2));
      }
    }

    const reserveMsg = reserveAssignments.length > 0 ? ` and ${reserveAssignments.length} reserve staff` : '';
    return NextResponse.json({
      success: true,
      message: `Auto-assignment complete. Created ${allNewAssignments.length} room assignments${reserveMsg} with ${allViolations.length} soft violation(s).`,
      assignmentsCreated: allNewAssignments.length,
      reservesCreated: reserveAssignments.length,
      violations: allViolations,
      cohortsSummary,
      staffBreakdown,
    });

  } catch (error: any) {
    console.error('Auto-assign error:', error);
    return NextResponse.json(
      { error: error.message || 'Auto-assignment failed' },
      { status: 500 }
    );
  }
}
