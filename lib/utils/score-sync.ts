import { SupabaseClient } from '@supabase/supabase-js';

export async function syncStaffScores(
  supabase: SupabaseClient,
  staffIds: string[],
  dateRange?: { startDate: string; endDate: string }
) {
  if (!staffIds || staffIds.length === 0) return;

  try {
    let start_date = dateRange?.startDate;
    let end_date = dateRange?.endDate;

    if (!start_date || !end_date) {
      // Try to fetch active period
      const { data: activePeriod } = await supabase
        .from('exam_periods')
        .select('start_date, end_date')
        .eq('is_active', true)
        .maybeSingle();

      if (activePeriod) {
        start_date = activePeriod.start_date;
        end_date = activePeriod.end_date;
      }
    }

    // 1. Get assignments for these staff members
    const { data: assignments, error: err1 } = await supabase
      .from('assignments')
      .select('staff_id, exam_session:exam_sessions(exam_date, start_time)')
      .in('staff_id', staffIds);

    if (err1) throw err1;

    // 2. Get reserves for these staff members
    const { data: reserves, error: err2 } = await supabase
      .from('period_free_staff')
      .select('staff_id, exam_date')
      .in('staff_id', staffIds);

    if (err2) throw err2;

    // 3. Calculate scores
    const staffUpdates: { id: string; current_score: number; free_staff_score: number }[] = [];

    for (const staffId of staffIds) {
      const staffAssignments = assignments.filter(a => {
        if (a.staff_id !== staffId || !a.exam_session) return false;
        const examDate = (a.exam_session as any).exam_date;
        if (start_date && end_date) {
          return examDate >= start_date && examDate <= end_date;
        }
        return true;
      });

      const uniquePeriods = new Set(
        staffAssignments.map(a => `${(a.exam_session as any).exam_date}_${(a.exam_session as any).start_time}`)
      );
      const current_score = uniquePeriods.size;

      const staffReserves = reserves.filter(r => {
        if (r.staff_id !== staffId) return false;
        if (start_date && end_date) {
          return r.exam_date >= start_date && r.exam_date <= end_date;
        }
        return true;
      });
      const free_staff_score = staffReserves.length;

      staffUpdates.push({
        id: staffId,
        current_score,
        free_staff_score,
      });
    }

    // 4. Update the staff members
    for (const update of staffUpdates) {
      await supabase
        .from('staff')
        .update({
          current_score: update.current_score,
          free_staff_score: update.free_staff_score,
        })
        .eq('id', update.id);
    }
  } catch (error) {
    console.error('Error syncing staff scores:', error);
  }
}
