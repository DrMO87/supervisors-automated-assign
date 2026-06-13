import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { isStaffAvailable } from '@/lib/algorithms/auto-assignment';
import { syncStaffScores } from '@/lib/utils/score-sync';
import type { Staff, ExamSession, Assignment, PeriodFreeStaff, CalendarRule } from '@/types/database.types';

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

    const { targetStaffId, weekStart } = await req.json();

    if (!targetStaffId || !weekStart) {
      return NextResponse.json({ error: 'targetStaffId and weekStart are required' }, { status: 400 });
    }

    const startDate = new Date(weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Fetch required data
    const [
      staffRes,
      sessionsRes,
      assignmentsRes,
      reservesRes,
      constraintsRes,
      calendarRulesRes
    ] = await Promise.all([
      supabaseAdmin.from('staff').select('*').limit(10000),
      supabaseAdmin.from('exam_sessions')
        .select('*')
        .gte('exam_date', startStr)
        .lt('exam_date', endStr)
        .limit(10000),
      supabaseAdmin.from('assignments')
        .select('*, exam_sessions!inner(exam_date)')
        .gte('exam_sessions.exam_date', startStr)
        .lt('exam_sessions.exam_date', endStr)
        .limit(10000),
      supabaseAdmin.from('period_free_staff')
        .select('*')
        .gte('exam_date', startStr)
        .lt('exam_date', endStr)
        .limit(10000),
      supabaseAdmin.from('system_settings').select('*').eq('setting_key', 'scheduling_constraints').single(),
      supabaseAdmin.from('system_settings').select('*').eq('setting_key', 'calendar_rules').single(),
    ]);

    if (staffRes.error) throw staffRes.error;
    if (sessionsRes.error) throw sessionsRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;
    if (reservesRes.error) throw reservesRes.error;

    const allStaff: Staff[] = staffRes.data || [];
    const sessions: ExamSession[] = sessionsRes.data || [];
    const assignments: Assignment[] = assignmentsRes.data || [];
    const reserves: PeriodFreeStaff[] = reservesRes.data || [];
    const constraints = constraintsRes.data?.setting_value || {};
    const calendarRules: CalendarRule[] = calendarRulesRes.data?.setting_value || [];
    const allExamDates = Array.from(new Set(sessions.map(s => s.exam_date)));

    const targetStaff = allStaff.find(s => s.id === targetStaffId);
    if (!targetStaff) {
      return NextResponse.json({ error: 'Target staff not found' }, { status: 404 });
    }

    const roleToMatch = targetStaff.supervision_role;

    // Identify target assignments
    const targetAssignments = assignments.filter(a => a.staff_id === targetStaffId);
    const targetReserves = reserves.filter(r => r.staff_id === targetStaffId);

    if (targetAssignments.length === 0 && targetReserves.length === 0) {
      return NextResponse.json({ success: true, message: 'No assignments to swap in this week.' });
    }

    // Prepare eligible candidates
    const eligibleCandidates = allStaff.filter(s => 
      s.id !== targetStaffId && 
      s.supervision_role === roleToMatch && 
      s.availability_status === 'Available'
    );

    const assignmentsToDelete: string[] = [];
    const reservesToDelete: string[] = [];
    const assignmentsToUpdate: { id: string; newStaffId: string }[] = [];
    const reservesToInsert: Omit<PeriodFreeStaff, 'id'>[] = [];

    // Make local copies of assignments to test availability sequentially
    let currentAssignments = [...assignments];
    let currentReserves = [...reserves];

    // 1. Process regular assignments
    for (const assignment of targetAssignments) {
      const session = sessions.find(s => s.id === assignment.exam_session_id);
      if (!session) continue;

      let bestReplacement: Staff | null = null;
      let lowestScore = Infinity;

      for (const candidate of eligibleCandidates) {
        // Calculate score
        const totalScore = (candidate.current_score || 0) + ((candidate.free_staff_score || 0) * 0.25);

        // Quick skip if we already found someone better
        if (bestReplacement && totalScore >= lowestScore) continue;

        const { available } = isStaffAvailable(
          candidate,
          session,
          currentAssignments,
          sessions,
          constraints,
          allExamDates,
          null, // targetRoom not strictly needed for availability check here
          currentReserves,
          calendarRules,
          0 // averageScore
        );

        if (available) {
          bestReplacement = candidate;
          lowestScore = totalScore;
        }
      }

      if (bestReplacement) {
        assignmentsToUpdate.push({ id: assignment.id, newStaffId: bestReplacement.id });
        // Update local state so subsequent iterations know this person is busy
        currentAssignments = currentAssignments.map(a => 
          a.id === assignment.id ? { ...a, staff_id: bestReplacement!.id } : a
        );
      } else {
        // Option B: Delete assignment if unswappable
        assignmentsToDelete.push(assignment.id);
      }
    }

    // 2. Process reserve assignments
    for (const reserve of targetReserves) {
      // Need a dummy session to check availability for the specific date and period
      const dummySession = {
        id: 'dummy',
        exam_date: reserve.exam_date,
        start_time: reserve.period === 1 ? '09:00' : '13:00', // approximation
        student_count: 0,
        room_id: 'dummy',
        is_locked: false,
        created_at: '',
        updated_at: ''
      } as ExamSession;

      let bestReplacement: Staff | null = null;
      let lowestScore = Infinity;

      for (const candidate of eligibleCandidates) {
        const totalScore = (candidate.current_score || 0) + ((candidate.free_staff_score || 0) * 0.25);
        if (bestReplacement && totalScore >= lowestScore) continue;

        const { available } = isStaffAvailable(
          candidate,
          dummySession,
          currentAssignments,
          sessions,
          constraints,
          allExamDates,
          null,
          currentReserves,
          calendarRules,
          0
        );

        // Must also ensure the candidate is not ALREADY a reserve for this period
        const isAlreadyReserve = currentReserves.some(r => 
          r.staff_id === candidate.id && 
          r.exam_date === reserve.exam_date && 
          r.period === reserve.period
        );

        if (available && !isAlreadyReserve) {
          bestReplacement = candidate;
          lowestScore = totalScore;
        }
      }

      if (bestReplacement) {
        reservesToDelete.push(reserve.id);
        reservesToInsert.push({
          exam_date: reserve.exam_date,
          period: reserve.period,
          staff_id: bestReplacement.id,
          role: reserve.role || 'Reserve'
        } as Omit<PeriodFreeStaff, 'id'>);
        // Update local state
        currentReserves = currentReserves.filter(r => r.id !== reserve.id);
        currentReserves.push({
          id: 'temp-' + Date.now(),
          exam_date: reserve.exam_date,
          period: reserve.period,
          staff_id: bestReplacement.id,
          role: reserve.role || 'Reserve'
        } as PeriodFreeStaff);
      } else {
        // Option B: Delete if unswappable
        reservesToDelete.push(reserve.id);
      }
    }

    // 3. Execute DB Operations
    const promises = [];

    // Delete unswappable/old assignments
    if (assignmentsToDelete.length > 0) {
      promises.push(supabaseAdmin.from('assignments').delete().in('id', assignmentsToDelete));
    }
    if (reservesToDelete.length > 0) {
      promises.push(supabaseAdmin.from('period_free_staff').delete().in('id', reservesToDelete));
    }

    // Update swappable assignments
    for (const update of assignmentsToUpdate) {
      promises.push(
        supabaseAdmin.from('assignments')
          .update({ staff_id: update.newStaffId })
          .eq('id', update.id)
      );
    }

    // Insert new reserves
    if (reservesToInsert.length > 0) {
      promises.push(supabaseAdmin.from('period_free_staff').insert(reservesToInsert));
    }

    await Promise.all(promises);

    // Sync scores for target staff and all replacements
    const affectedStaffIds = new Set<string>([targetStaffId]);
    assignmentsToUpdate.forEach(u => affectedStaffIds.add(u.newStaffId));
    reservesToInsert.forEach(r => affectedStaffIds.add(r.staff_id));
    
    await syncStaffScores(supabaseAdmin, Array.from(affectedStaffIds));

    // Invalidate caches
    revalidatePath('/reports');
    revalidatePath('/dashboard');
    revalidatePath('/swaps');
    revalidatePath('/admin-reports');

    return NextResponse.json({ 
      success: true, 
      replacedAssignments: assignmentsToUpdate.length,
      deletedAssignments: assignmentsToDelete.length,
      replacedReserves: reservesToInsert.length,
      deletedReserves: reservesToDelete.length - reservesToInsert.length
    });

  } catch (err: any) {
    console.error('Bulk replace error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
