import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { startOfWeek } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get('period_id');

    let query = supabaseAdmin
      .from('exam_period_backups')
      .select('*')
      .order('created_at', { ascending: false });

    if (periodId) {
      query = query.eq('period_id', periodId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching period backups:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ backups: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { week_start_date, trigger_type, backup_name } = body;

    // 1. Fetch active period
    const { data: activePeriod, error: pErr } = await supabaseAdmin
      .from('exam_periods')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (pErr || !activePeriod) {
      return NextResponse.json({ error: 'No active exam period found' }, { status: 400 });
    }

    // Determine week start date if not provided (Saturday is week start in Horus Univ)
    const effectiveWeekStart = week_start_date || 
      startOfWeek(new Date(), { weekStartsOn: 6 }).toISOString().split('T')[0];

    const weekLabel = `Week starting ${effectiveWeekStart}`;
    const name = backup_name || `${trigger_type === 'automatic' ? 'Auto End-of-Week' : 'Manual'} Snapshot - ${activePeriod.name} (${effectiveWeekStart})`;

    // 2. Fetch full period snapshot data
    const [
      { data: staff },
      { data: rooms },
      { data: exams },
      { data: assignments },
      { data: freeStaff },
      { data: settings }
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
        .lte('exam_date', activePeriod.end_date),
      supabaseAdmin.from('system_settings').select('*')
    ]);

    // Clean joined nested property from assignments before snapshotting
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
      period_free_staff: freeStaff || [],
      system_settings: settings || []
    };

    // 3. Upsert backup record
    const { data: newBackup, error: insertErr } = await supabaseAdmin
      .from('exam_period_backups')
      .upsert({
        period_id: activePeriod.id,
        period_name: activePeriod.name,
        week_start_date: effectiveWeekStart,
        week_label: weekLabel,
        backup_name: name,
        trigger_type: trigger_type || 'manual',
        snapshot_data: snapshotData,
        created_at: new Date().toISOString(),
      }, { onConflict: 'period_id, week_start_date, trigger_type' })
      .select('*')
      .single();

    if (insertErr) {
      console.error('Error creating period backup:', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, backup: newBackup });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
