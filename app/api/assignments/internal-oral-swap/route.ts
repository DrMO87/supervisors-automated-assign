import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { syncStaffScores } from '@/lib/utils/score-sync';
import { getPeriodFromTime } from '@/types/database.types';

import { HOD_EMAILS } from '@/lib/config/hod-accounts';

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  const email = session?.user?.email?.toLowerCase() || '';

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized Access.' }, { status: 403 });
  }

  // Allow Super Admin or specific HOD emails
  const isSuperAdmin = email === 'melkhodary@horus.edu.eg';
  const isHOD = HOD_EMAILS.includes(email);

  if (!isSuperAdmin && !isHOD) {
    return NextResponse.json({ error: 'Forbidden. Only Heads of Departments can perform internal oral swaps.' }, { status: 403 });
  }

  try {
    const { assignmentId1, assignmentId2 } = await req.json();

    if (!assignmentId1 || !assignmentId2) {
      return NextResponse.json({ error: 'Missing assignment IDs' }, { status: 400 });
    }

    if (assignmentId1 === assignmentId2) {
      return NextResponse.json({ error: 'Cannot swap an assignment with itself' }, { status: 400 });
    }

    // Fetch both assignments and their sessions
    const { data: assignments, error: fetchError } = await supabase
      .from('assignments')
      .select('id, staff_id, role, exam_session:exam_sessions(id, exam_date, start_time, exam_type, subject_name)')
      .in('id', [assignmentId1, assignmentId2]);

    if (fetchError) throw fetchError;

    if (!assignments || assignments.length !== 2) {
      return NextResponse.json({ error: 'One or both assignments not found' }, { status: 404 });
    }

    const a1 = assignments[0];
    const a2 = assignments[1];

    // Ensure both are oral exams
    if (a1.exam_session.exam_type !== 'Oral' || a2.exam_session.exam_type !== 'Oral') {
       return NextResponse.json({ error: 'Both assignments must be for Oral Exams.' }, { status: 400 });
    }

    // Ensure same date
    if (a1.exam_session.exam_date !== a2.exam_session.exam_date) {
      return NextResponse.json({ error: 'Exams must be on the same date.' }, { status: 400 });
    }

    // Ensure same period
    const period1 = getPeriodFromTime(a1.exam_session.start_time);
    const period2 = getPeriodFromTime(a2.exam_session.start_time);
    
    if (period1 !== period2) {
      return NextResponse.json({ error: 'Exams must be in the same period.' }, { status: 400 });
    }

    // Perform swap: Update staff_id on both assignments
    const { error: update1Error } = await supabase
      .from('assignments')
      .update({ staff_id: a2.staff_id, is_manual_override: true })
      .eq('id', a1.id);

    if (update1Error) throw update1Error;

    const { error: update2Error } = await supabase
      .from('assignments')
      .update({ staff_id: a1.staff_id, is_manual_override: true })
      .eq('id', a2.id);

    if (update2Error) {
      // Attempt rollback
      await supabase.from('assignments').update({ staff_id: a1.staff_id }).eq('id', a1.id);
      throw update2Error;
    }

    // Sync scores for both staff members
    await syncStaffScores(supabase, [a1.staff_id, a2.staff_id]);

    // Invalidate caches
    revalidatePath('/reports');
    revalidatePath('/dashboard');
    revalidatePath('/swaps');
    revalidatePath('/staff-portal');

    return NextResponse.json({ success: true, message: 'Internal swap executed successfully.' });

  } catch (error: any) {
    console.error('Error executing internal swap:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
