import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';
import { batchAssign, AutoAssignConfig } from '@/lib/algorithms/auto-assignment';
import { createSnapshot } from '@/lib/utils/snapshot-helpers';
import type {
  Staff,
  ExamSession,
  Assignment,
  Room,
  StaffingRatiosConfig,
  SchedulingConstraintsConfig,
  PeriodFreeStaff,
} from '@/types/database.types';
import { getPeriodFromTime } from '@/types/database.types';

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (!session || session.user.user_metadata?.role !== 'control') {
      return NextResponse.json({ error: 'Unauthorized Access. Administrators only.' }, { status: 403 });
    }

    if (!isSupabaseConfigured() || !supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase is not configured. Please set up your environment variables.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { weekStart, onlyOral, assignmentScope } = body;
    
    // assignmentScope can be 'final', 'oral', 'reserve', or 'all'
    const isFinalOnly = assignmentScope === 'final';
    const isOralOnly = assignmentScope === 'oral' || onlyOral;
    const isReserveOnly = assignmentScope === 'reserve';

    if (!weekStart) {
      return NextResponse.json({ error: 'weekStart is required' }, { status: 400 });
    }

    const startDate = new Date(weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // ── Fetch all required data in parallel ──────────────────────────────
    const [staffResult, periodFreeStaffResult, sessionsResult, existingAssignmentsResult, roomsResult, ratiosSettingResult, constraintsSettingResult, calendarRulesResult] =
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
      ]);

    if (staffResult.error) throw staffResult.error;
    if (periodFreeStaffResult.error) throw periodFreeStaffResult.error;
    if (sessionsResult.error) throw sessionsResult.error;
    if (existingAssignmentsResult.error) throw existingAssignmentsResult.error;
    if (roomsResult.error) throw roomsResult.error;

    const staff: Staff[] = staffResult.data || [];
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

    const constraints: SchedulingConstraintsConfig = {
      allow_consecutive_shifts: savedConstraints.allow_consecutive_shifts ?? false,
      max_hours_per_week_ft:    savedConstraints.max_hours_per_week_ft    ?? 16,
      max_hours_per_week_pt:    savedConstraints.max_hours_per_week_pt    ?? 8,
      max_hours_per_week_chemist: savedConstraints.max_hours_per_week_chemist ?? 20,
      enforce_strict_roles:     savedConstraints.enforce_strict_roles     ?? false, // default OFF for best coverage
      max_rooms_per_lecturer:   savedConstraints.max_rooms_per_lecturer   ?? 3,
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
    const config: AutoAssignConfig = { ratios: staffingRatios, constraints, calendarRules };

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
      } else if (isFinalOnly) {
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
    const sessionIdsToDeleteSet = new Set(!isReserveOnly ? (isOralOnly ? sessions.filter(s => !!s.exam_type?.toLowerCase().includes('oral')) : isFinalOnly ? sessions.filter(s => !s.exam_type?.toLowerCase().includes('oral')) : sessions).map(s => s.id) : []);
    const filteredExistingAssignments = existingAssignments.filter(a => !sessionIdsToDeleteSet.has(a.exam_session_id));

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
        isFinalOnly
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
    }

    return NextResponse.json({
      success: true,
      message: `Auto-assignment complete. Created ${allNewAssignments.length} assignments with ${allViolations.length} soft violation(s).`,
      assignmentsCreated: allNewAssignments.length,
      violations: allViolations,
    });

  } catch (error: any) {
    console.error('Auto-assign error:', error);
    return NextResponse.json(
      { error: error.message || 'Auto-assignment failed' },
      { status: 500 }
    );
  }
}
