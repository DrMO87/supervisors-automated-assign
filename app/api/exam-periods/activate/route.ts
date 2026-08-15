import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const { period_id } = await req.json();

    if (!period_id) {
      return NextResponse.json({ error: 'Missing period_id' }, { status: 400 });
    }

    // 1. Get target period
    const { data: targetPeriod, error: fetchErr } = await supabaseAdmin
      .from('exam_periods')
      .select('*')
      .eq('id', period_id)
      .single();

    if (fetchErr || !targetPeriod) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    // 2. Deactivate all periods
    await supabaseAdmin
      .from('exam_periods')
      .update({ is_active: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    // 3. Activate target period
    const { data: updatedPeriod, error: updateErr } = await supabaseAdmin
      .from('exam_periods')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', period_id)
      .select('*')
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 4. Recalculate staff scores for this active period date range
    const { data: staffList } = await supabaseAdmin
      .from('staff')
      .select('id');

    const { data: assignments } = await supabaseAdmin
      .from('assignments')
      .select('staff_id, exam_session:exam_sessions(exam_date, start_time)');

    const { data: reserves } = await supabaseAdmin
      .from('period_free_staff')
      .select('staff_id, exam_date');

    if (staffList) {
      for (const s of staffList) {
        const staffAssignments = (assignments || []).filter(a => {
          const date = (a.exam_session as any)?.exam_date;
          return a.staff_id === s.id && date >= targetPeriod.start_date && date <= targetPeriod.end_date;
        });

        const uniquePeriods = new Set(staffAssignments.map(a => `${(a.exam_session as any).exam_date}_${(a.exam_session as any).start_time}`));
        const staffReserves = (reserves || []).filter(r => r.staff_id === s.id && r.exam_date >= targetPeriod.start_date && r.exam_date <= targetPeriod.end_date);

        await supabaseAdmin
          .from('staff')
          .update({
            current_score: uniquePeriods.size,
            free_staff_score: staffReserves.length,
          })
          .eq('id', s.id);
      }
    }

    return NextResponse.json({ success: true, period: updatedPeriod });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
