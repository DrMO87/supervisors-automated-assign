import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// We must use the service role key to bypass RLS if needed, or anon key if RLS is public
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
const supabaseAuth = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabaseAuth.auth.getSession();
    const email = session?.user?.email?.toLowerCase();
    if (!session || email !== 'melkhodary@horus.edu.eg') {
      return NextResponse.json({ error: 'Unauthorized Access. Super Administrators only.' }, { status: 403 });
    }

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

    // 4. Score updates are handled automatically by the Supabase database triggers `tr_sync_staff_score` and `tr_sync_staff_free_score` when assignments are deleted.
    

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Reset week error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
