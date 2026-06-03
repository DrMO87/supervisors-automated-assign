const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://chauqwnfzjskbucoppwb.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_80BAZpxQpqVr6z50lv-H-Q_yxnCO97c';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('Fetching all data...');
  const [staffRes, assignmentsRes, sessionsRes, freeRes] = await Promise.all([
    supabaseAdmin.from('staff').select('id, name'),
    supabaseAdmin.from('assignments').select('staff_id, exam_session_id'),
    supabaseAdmin.from('exam_sessions').select('id, exam_date, start_time'),
    supabaseAdmin.from('period_free_staff').select('staff_id')
  ]);

  const staff = staffRes.data || [];
  const assignments = assignmentsRes.data || [];
  const sessions = sessionsRes.data || [];
  const freeStaff = freeRes.data || [];

  console.log(`Fetched ${staff.length} staff, ${assignments.length} assignments, ${freeStaff.length} free slots.`);

  // Create session lookup
  const sessionMap = new Map();
  sessions.forEach((s: any) => sessionMap.set(s.id, s));

  // Calculate scores
  const mainScores = new Map();
  const freeScores = new Map();

  // Count free scores
  freeStaff.forEach((f: any) => {
    freeScores.set(f.staff_id, (freeScores.get(f.staff_id) || 0) + 1);
  });

  // Count distinct periods for main scores
  const staffPeriods = new Map();
  assignments.forEach((a: any) => {
    const s = sessionMap.get(a.exam_session_id);
    if (s) {
      if (!staffPeriods.has(a.staff_id)) staffPeriods.set(a.staff_id, new Set());
      staffPeriods.get(a.staff_id).add(`${s.exam_date}_${s.start_time}`);
    }
  });
  
  staffPeriods.forEach((periods, staffId) => {
    mainScores.set(staffId, periods.size);
  });

  console.log('Updating database...');
  let updated = 0;
  
  // Update in chunks
  const chunkSize = 20;
  for (let i = 0; i < staff.length; i += chunkSize) {
    const chunk = staff.slice(i, i + chunkSize);
    await Promise.all(chunk.map((s: any) => {
      const cScore = mainScores.get(s.id) || 0;
      const fScore = freeScores.get(s.id) || 0;
      return supabaseAdmin.from('staff').update({ current_score: cScore, free_staff_score: fScore }).eq('id', s.id);
    }));
    updated += chunk.length;
    console.log(`Updated ${updated}/${staff.length}...`);
  }

  console.log('Done!');
}

main().catch(console.error);
