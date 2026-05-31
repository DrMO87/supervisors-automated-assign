import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPeriodFromTime } from '@/types/database.types';

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const { requestId, action } = await req.json();

    if (!requestId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Get the swap request
    const { data: request, error: reqError } = await supabase
      .from('swap_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (reqError || !request) {
      return NextResponse.json({ error: 'Swap request not found' }, { status: 404 });
    }

    if (request.status !== 'pending') {
      return NextResponse.json({ error: `Request is already ${request.status}` }, { status: 400 });
    }

    if (action === 'reject') {
      const { error: updateError } = await supabase
        .from('swap_requests')
        .update({ status: 'rejected', resolved_at: new Date().toISOString() })
        .eq('id', requestId);

      if (updateError) throw updateError;
      return NextResponse.json({ success: true, message: 'Request rejected' });
    }

    // If approving, we need to find the assignments and swap the staff_id
    // First, find exam sessions for that date and room
    const { data: sessions, error: sessionError } = await supabase
      .from('exam_sessions')
      .select('id, start_time')
      .eq('exam_date', request.exam_date)
      .eq('room_id', request.room_id);

    if (sessionError) throw sessionError;

    // Filter sessions matching the requested period
    const targetSessionIds = sessions
      ?.filter(s => getPeriodFromTime(s.start_time) === request.period)
      .map(s => s.id) || [];

    if (targetSessionIds.length === 0) {
      return NextResponse.json({ error: 'No exam sessions found for this date, room, and period.' }, { status: 404 });
    }

    // Find the assignments for the original staff in these sessions
    const { data: assignments, error: assignError } = await supabase
      .from('assignments')
      .select('id')
      .in('exam_session_id', targetSessionIds)
      .eq('staff_id', request.original_staff_id);

    if (assignError) throw assignError;

    if (!assignments || assignments.length === 0) {
      return NextResponse.json({ error: 'The originally assigned staff is not assigned to this room during this period.' }, { status: 404 });
    }

    const assignmentIds = assignments.map(a => a.id);

    // Swap the staff ID in assignments (Trigger automatically updates workload scores!)
    const { error: swapError } = await supabase
      .from('assignments')
      .update({ staff_id: request.replacement_staff_id, is_manual_override: true })
      .in('id', assignmentIds);

    if (swapError) throw swapError;

    // Mark request as approved
    const { error: finalUpdateError } = await supabase
      .from('swap_requests')
      .update({ status: 'approved', resolved_at: new Date().toISOString() })
      .eq('id', requestId);

    if (finalUpdateError) throw finalUpdateError;

    return NextResponse.json({ success: true, message: 'Swap approved and applied successfully' });

  } catch (error: any) {
    console.error('Error approving swap:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
