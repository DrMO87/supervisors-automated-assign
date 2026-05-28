import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// We must use the service role key to bypass RLS if needed, or anon key if RLS is public
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { weekStart } = await req.json();
    if (!weekStart) {
      return NextResponse.json({ error: 'weekStart is required' }, { status: 400 });
    }

    const startDate = new Date(weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // 1. Get all sessions for this week
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('exam_sessions')
      .select('id')
      .gte('exam_date', startStr)
      .lt('exam_date', endStr);

    if (sessionsError) throw sessionsError;

    const sessionIds = sessions.map(s => s.id);

    // 2. Delete assignments
    if (sessionIds.length > 0) {
      const { error: delError } = await supabaseAdmin
        .from('assignments')
        .delete()
        .in('exam_session_id', sessionIds);
      if (delError) throw delError;
    }

    // 3. Delete period_free_staff for this week
    const { error: pfError } = await supabaseAdmin
      .from('period_free_staff')
      .delete()
      .gte('exam_date', startStr)
      .lt('exam_date', endStr);
    if (pfError) throw pfError;

    // 4. Recalculate staff scores
    // Fetch all assignments for all time to recount
    const { data: allAssignments, error: aError } = await supabaseAdmin.from('assignments').select('staff_id, exam_session_id');
    const { data: allSessions, error: sError } = await supabaseAdmin.from('exam_sessions').select('id, exam_date, start_time');
    
    if (!aError && !sError && allAssignments && allSessions) {
      const staffScores = new Map<string, Set<string>>();
      allAssignments.forEach(a => {
        if (!staffScores.has(a.staff_id)) staffScores.set(a.staff_id, new Set());
        const session = allSessions.find(s => s.id === a.exam_session_id);
        if (session) {
          staffScores.get(a.staff_id)!.add(`${session.exam_date}_${session.start_time}`);
        }
      });
      
      const { data: allStaff } = await supabaseAdmin.from('staff').select('id, current_score');
      if (allStaff) {
        // Prepare updates for staff whose score changed
        for (const st of allStaff) {
          const newScore = staffScores.get(st.id)?.size || 0;
          if (st.current_score !== newScore) {
            await supabaseAdmin.from('staff').update({ current_score: newScore }).eq('id', st.id);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Reset week error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
