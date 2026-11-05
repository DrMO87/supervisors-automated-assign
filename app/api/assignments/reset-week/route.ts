import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logActivity } from '@/lib/utils/audit-logger';

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

    // 1. Get all sessions for this week
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('exam_sessions')
      .select('id')
      .gte('exam_date', startStr)
      .lt('exam_date', endStr);

    if (sessionsError) throw sessionsError;

    const sessionIds = sessions.map(s => s.id);

    // 2. Delete assignments
    let deletedCount = 0;
    if (sessionIds.length > 0) {
      const { data: delData, error: delError } = await supabaseAdmin
        .from('assignments')
        .delete()
        .in('exam_session_id', sessionIds)
        .select('id');
      if (delError) throw delError;
      deletedCount = delData?.length || 0;
    }

    // 3. Delete period_free_staff for this week
    const { error: pfError } = await supabaseAdmin
      .from('period_free_staff')
      .delete()
      .gte('exam_date', startStr)
      .lt('exam_date', endStr);
    if (pfError) throw pfError;

    // 4. Log audit activity
    try {
      await logActivity(supabaseAdmin, {
        action: 'DELETE',
        tableName: 'assignments',
        recordId: sessionIds[0] || '00000000-0000-0000-0000-000000000000',
        summary: `Reset all schedule assignments and reserves for week of ${formattedWeekLabel}`,
        userEmail: email,
        userRole: 'Super Admin',
      });
    } catch (e) {
      console.warn('Failed to log reset week activity:', e);
    }

    return NextResponse.json({ success: true, deletedCount });
  } catch (err: any) {
    console.error('Reset week error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
