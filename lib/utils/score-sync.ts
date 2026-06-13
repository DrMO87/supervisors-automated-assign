import { SupabaseClient } from '@supabase/supabase-js';

export async function syncStaffScores(supabase: SupabaseClient, staffIds: string[]) {
  if (!staffIds || staffIds.length === 0) return;

  try {
    // 1. Get assignments for these staff members
    const { data: assignments, error: err1 } = await supabase
      .from('assignments')
      .select('staff_id, exam_session:exam_sessions(exam_date, start_time)')
      .in('staff_id', staffIds);

    if (err1) throw err1;

    // 2. Get reserves for these staff members
    const { data: reserves, error: err2 } = await supabase
      .from('period_free_staff')
      .select('staff_id')
      .in('staff_id', staffIds);

    if (err2) throw err2;

    // 3. Calculate scores
    const staffUpdates: { id: string; current_score: number; free_staff_score: number }[] = [];

    for (const staffId of staffIds) {
      const staffAssignments = assignments.filter(a => a.staff_id === staffId && a.exam_session);
      const uniquePeriods = new Set(staffAssignments.map(a => `${(a.exam_session as any).exam_date}_${(a.exam_session as any).start_time}`));
      const current_score = uniquePeriods.size;

      const staffReserves = reserves.filter(r => r.staff_id === staffId);
      const free_staff_score = staffReserves.length;

      staffUpdates.push({
        id: staffId,
        current_score,
        free_staff_score
      });
    }

    // 4. Update the staff members (do it sequentially to avoid race conditions)
    for (const update of staffUpdates) {
      await supabase
        .from('staff')
        .update({ 
          current_score: update.current_score, 
          free_staff_score: update.free_staff_score 
        })
        .eq('id', update.id);
    }

  } catch (error) {
    console.error('Error syncing staff scores:', error);
  }
}
