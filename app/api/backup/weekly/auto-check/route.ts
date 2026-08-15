import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { startOfWeek } from 'date-fns';

export async function POST() {
  try {
    // 1. Fetch active period
    const { data: activePeriod } = await supabaseAdmin
      .from('exam_periods')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (!activePeriod) {
      return NextResponse.json({ autoBackupCreated: false, reason: 'No active period' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (todayStr < activePeriod.start_date || todayStr > activePeriod.end_date) {
      return NextResponse.json({ autoBackupCreated: false, reason: 'Current date outside active period date range' });
    }

    // Week start date (Saturday)
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 6 }).toISOString().split('T')[0];

    // Check if automatic backup already exists for this period & week
    const { data: existing } = await supabaseAdmin
      .from('exam_period_backups')
      .select('id')
      .eq('period_id', activePeriod.id)
      .eq('week_start_date', currentWeekStart)
      .eq('trigger_type', 'automatic')
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ autoBackupCreated: false, reason: 'End-of-week backup already exists for this week' });
    }

    // Call internal snapshot creation
    const [
      { data: staff },
      { data: rooms },
      { data: exams },
      { data: assignments },
      { data: freeStaff }
    ] = await Promise.all([
      supabaseAdmin.from('staff').select('*'),
      supabaseAdmin.from('rooms').select('*'),
      supabaseAdmin.from('exam_sessions')
        .select('*')
        .gte('exam_date', activePeriod.start_date)
        .lte('exam_date', activePeriod.end_date),
      supabaseAdmin.from('assignments')
        .select('*, exam_session:exam_sessions!inner(*)')
        .gte('exam_session.exam_date', activePeriod.start_date)
        .lte('exam_session.exam_date', activePeriod.end_date),
      supabaseAdmin.from('period_free_staff')
        .select('*')
        .gte('exam_date', activePeriod.start_date)
        .lte('exam_date', activePeriod.end_date)
    ]);

    const cleanAssignments = (assignments || []).map(a => {
      const { exam_session, ...rest } = a as any;
      return rest;
    });

    const snapshotData = {
      period: activePeriod,
      staff: staff || [],
      rooms: rooms || [],
      exams: exams || [],
      assignments: cleanAssignments,
      period_free_staff: freeStaff || []
    };

    const { data: backup, error: insertErr } = await supabaseAdmin
      .from('exam_period_backups')
      .insert({
        period_id: activePeriod.id,
        period_name: activePeriod.name,
        week_start_date: currentWeekStart,
        week_label: `Week starting ${currentWeekStart}`,
        backup_name: `Auto End-of-Week Snapshot - ${activePeriod.name} (${currentWeekStart})`,
        trigger_type: 'automatic',
        snapshot_data: snapshotData,
      })
      .select('*')
      .single();

    if (insertErr) {
      console.error('Auto backup insert error:', insertErr);
      return NextResponse.json({ autoBackupCreated: false, error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ autoBackupCreated: true, backup });
  } catch (err: any) {
    return NextResponse.json({ autoBackupCreated: false, error: err.message }, { status: 500 });
  }
}
