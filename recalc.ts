const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://chauqwnfzjskbucoppwb.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_80BAZpxQpqVr6z50lv-H-Q_yxnCO97c';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  console.log('Fetching staff...');
  const { data: staff, error: staffError } = await supabaseAdmin.from('staff').select('id, name');
  if (staffError) {
    console.error('Error fetching staff:', staffError);
    return;
  }
  
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
      const sessionIds = assignments.map((a: any) => a.exam_session_id);
      const { data: sessions } = await supabaseAdmin
        .from('exam_sessions')
        .select('exam_date, start_time')
        .in('id', sessionIds);

      if (sessions) {
        const uniquePeriods = new Set(sessions.map((s: any) => `${s.exam_date}_${s.start_time}`));
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

  console.log(`Successfully recalculated scores. Updated main: ${updatedMain}, updated free: ${updatedFree}`);
}

main().catch(console.error);
