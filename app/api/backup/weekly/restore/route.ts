import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const { backup_id } = await req.json();

    if (!backup_id) {
      return NextResponse.json({ error: 'Missing backup_id' }, { status: 400 });
    }

    // 1. Fetch backup record
    const { data: backup, error: fetchErr } = await supabaseAdmin
      .from('exam_period_backups')
      .select('*')
      .eq('id', backup_id)
      .single();

    if (fetchErr || !backup || !backup.snapshot_data) {
      return NextResponse.json({ error: 'Backup snapshot not found or corrupted' }, { status: 404 });
    }

    const { period, staff, rooms, exams, assignments, period_free_staff } = backup.snapshot_data as any;

    if (!period || !staff) {
      return NextResponse.json({ error: 'Incomplete backup snapshot data' }, { status: 400 });
    }

    // 2. Clear current period assignments and reserves to prevent duplicates
    if (exams && exams.length > 0) {
      const examIds = exams.map((e: any) => e.id);
      
      await supabaseAdmin
        .from('assignments')
        .delete()
        .in('exam_session_id', examIds);

      await supabaseAdmin
        .from('period_free_staff')
        .delete()
        .gte('exam_date', period.start_date)
        .lte('exam_date', period.end_date);
    }

    // 3. Restore staff availability, condition flags, and scores
    if (staff && staff.length > 0) {
      for (const s of staff) {
        await supabaseAdmin
          .from('staff')
          .update({
            current_score: s.current_score || 0,
            free_staff_score: s.free_staff_score || 0,
            availability_status: s.availability_status,
            working_days: s.working_days,
            specific_off_dates: s.specific_off_dates || [],
            specific_standard_off_dates: s.specific_standard_off_dates || [],
            is_feeding_mother: s.is_feeding_mother,
            has_health_issue: s.has_health_issue,
            is_overloaded: s.is_overloaded,
            overload_percentage: s.overload_percentage,
          })
          .eq('id', s.id);
      }
    }

    // 4. Re-insert backup assignments
    if (assignments && assignments.length > 0) {
      const cleanAssignments = assignments.map((a: any) => ({
        id: a.id,
        exam_session_id: a.exam_session_id,
        staff_id: a.staff_id,
        role: a.role,
        is_manual_override: a.is_manual_override || false,
        assigned_at: a.assigned_at || new Date().toISOString(),
      }));

      const { error: insertAssignErr } = await supabaseAdmin
        .from('assignments')
        .upsert(cleanAssignments, { onConflict: 'exam_session_id, staff_id' });

      if (insertAssignErr) {
        console.error('Error restoring assignments:', insertAssignErr);
      }
    }

    // 5. Re-insert backup period free staff
    if (period_free_staff && period_free_staff.length > 0) {
      const cleanReserves = period_free_staff.map((r: any) => ({
        id: r.id,
        exam_date: r.exam_date,
        period: r.period,
        start_time: r.start_time,
        staff_id: r.staff_id,
        role: r.role,
        created_at: r.created_at || new Date().toISOString(),
      }));

      await supabaseAdmin
        .from('period_free_staff')
        .upsert(cleanReserves, { onConflict: 'exam_date, period, staff_id' });
    }

    return NextResponse.json({
      success: true,
      message: `Restored snapshot "${backup.backup_name}" successfully!`,
      details: {
        restoredStaffCount: staff.length,
        restoredAssignmentsCount: assignments?.length || 0,
        restoredReservesCount: period_free_staff?.length || 0,
      },
    });
  } catch (err: any) {
    console.error('Restore error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
