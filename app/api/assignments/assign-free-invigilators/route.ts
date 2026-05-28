import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/client';
import { allocateReserveStaff } from '@/lib/algorithms/auto-assignment';
import { createSnapshot } from '@/lib/utils/snapshot-helpers';
import type {
  Staff,
  ExamSession,
  Assignment,
  StaffingRatiosConfig,
  SchedulingConstraintsConfig,
} from '@/types/database.types';

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured() || !supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase is not configured. Please set up your environment variables.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { weekStart } = body;

    if (!weekStart) {
      return NextResponse.json({ error: 'weekStart is required' }, { status: 400 });
    }

    const startDate = new Date(weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Fetch required data
    const [
      staffResult,
      sessionsResult,
      assignmentsResult,
      ratiosSettingResult,
      constraintsSettingResult,
    ] = await Promise.all([
      supabaseAdmin.from('staff').select('*').limit(10000),
      supabaseAdmin.from('exam_sessions')
        .select('*')
        .gte('exam_date', startStr)
        .lt('exam_date', endStr)
        .limit(10000),
      supabaseAdmin.from('assignments').select('*').limit(10000),
      supabaseAdmin.from('system_settings').select('*').eq('setting_key', 'staffing_ratios').single(),
      supabaseAdmin.from('system_settings').select('*').eq('setting_key', 'scheduling_constraints').single(),
    ]);

    if (staffResult.error) throw staffResult.error;
    if (sessionsResult.error) throw sessionsResult.error;
    if (assignmentsResult.error) throw assignmentsResult.error;

    const staff: Staff[] = staffResult.data || [];
    const sessions: ExamSession[] = sessionsResult.data || [];
    const existingAssignments: Assignment[] = assignmentsResult.data || [];

    // Load settings from DB (fall back to safe defaults)
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
      max_hours_per_week_ft:    savedConstraints.max_hours_per_week_ft    ?? 18,
      max_hours_per_week_pt:    savedConstraints.max_hours_per_week_pt    ?? 10,
      enforce_strict_roles:     savedConstraints.enforce_strict_roles     ?? false,
      max_rooms_per_lecturer:   savedConstraints.max_rooms_per_lecturer   ?? 3,
    };

    const config = {
      ratios: staffingRatios,
      constraints,
    };

    if (sessions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No exam sessions found for this week',
        assignmentsCreated: 0,
      });
    }

    if (staff.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No staff members found',
      });
    }

    // 0. Fetch old reserve assignments so we can update their scores later and reset our local array
    const { data: oldReserves } = await supabaseAdmin
      .from('period_free_staff')
      .select('staff_id')
      .gte('exam_date', startStr)
      .lt('exam_date', endStr);

    const oldStaffIds = oldReserves ? oldReserves.map(r => r.staff_id) : [];

    // Adjust free_staff_score in our local `staff` array by subtracting the scores of the old reserves for this week.
    // This gives the algorithm a clean slate for the current week, so re-running the algorithm produces consistent results.
    oldStaffIds.forEach(id => {
      const s = staff.find(x => x.id === id);
      if (s && s.free_staff_score) {
        s.free_staff_score = Math.max(0, s.free_staff_score - 1);
      }
    });

    // Take snapshot before major assignment
    try {
      await createSnapshot();
    } catch (e) {
      console.warn('Failed to create snapshot before assign free', e);
    }

    const reserveAssignments = allocateReserveStaff(sessions, staff, existingAssignments, config);

    if (reserveAssignments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No reserve staff could be allocated. Either staff are busy or unavailable.',
        assignmentsCreated: 0,
      });
    }

    // 1. Delete old reserve assignments for this week (to avoid duplicates if run multiple times)
    const { error: deleteError } = await supabaseAdmin
      .from('period_free_staff')
      .delete()
      .gte('exam_date', startStr)
      .lt('exam_date', endStr);

    if (deleteError) throw deleteError;

    // 2. Save the new reserve assignments to the period_free_staff table
    const { error: insertError } = await supabaseAdmin
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

    if (insertError) throw insertError;

    // 3. Update free_staff_score in the staff table
    // Fetch unique staff members whose score increased
    const staffIdsToUpdate = new Set([...oldStaffIds, ...reserveAssignments.map(r => r.staff_id)]);
    
    if (staffIdsToUpdate.size > 0) {
      // Recalculate free staff score for each staff by counting their records in period_free_staff table
      const { data: allReserves } = await supabaseAdmin.from('period_free_staff').select('staff_id').limit(10000);
      
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

    return NextResponse.json({
      success: true,
      message: `Successfully allocated ${reserveAssignments.length} reserve/standby staff!`,
      assignmentsCreated: reserveAssignments.length,
    });

  } catch (error: any) {
    console.error('Assign free invigilators error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to assign reserve staff' },
      { status: 500 }
    );
  }
}
