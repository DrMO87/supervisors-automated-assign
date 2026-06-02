import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const { data: staff, error: staffError } = await supabaseAdmin.from('staff').select('id');
    if (staffError) throw staffError;

    let updatedMain = 0;
    let updatedFree = 0;

    for (const member of staff) {
      // Recalculate main assignments
      const { data: assignments } = await supabaseAdmin
        .from('assignments')
        .select('exam_session_id')
        .eq('staff_id', member.id);

      let distinctPeriods = 0;
      if (assignments && assignments.length > 0) {
        const sessionIds = assignments.map(a => a.exam_session_id);
        const { data: sessions } = await supabaseAdmin
          .from('exam_sessions')
          .select('exam_date, start_time')
          .in('id', sessionIds);

        if (sessions) {
          const uniquePeriods = new Set(sessions.map(s => `${s.exam_date}_${s.start_time}`));
          distinctPeriods = uniquePeriods.size;
        }
      }

      await supabaseAdmin.from('staff').update({ current_score: distinctPeriods }).eq('id', member.id);
      updatedMain++;

      // Recalculate reserve assignments
      const { count: freeCount, error: freeError } = await supabaseAdmin
        .from('period_free_staff')
        .select('*', { count: 'exact', head: true })
        .eq('staff_id', member.id);

      if (!freeError) {
        await supabaseAdmin.from('staff').update({ free_staff_score: freeCount || 0 }).eq('id', member.id);
        updatedFree++;
      }
    }

    return NextResponse.json({ success: true, updatedMain, updatedFree });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
