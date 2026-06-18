require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data: staff, error } = await supabase.from('staff').select('*');
  if (error) throw error;
  
  const { data: assignments, error: err2 } = await supabase.from('assignments').select('*, exam_session:exam_sessions(exam_date, start_time)');
  if (err2) throw err2;

  const { data: reserves, error: err3 } = await supabase.from('period_free_staff').select('*');
  if (err3) throw err3;

  let outOfSync = false;
  
  for (const s of staff) {
    // calculate score
    const staffAssignments = assignments.filter(a => a.staff_id === s.id && a.exam_session);
    const uniquePeriods = new Set(staffAssignments.map(a => `${a.exam_session.exam_date}_${a.exam_session.start_time}`));
    const actualScore = uniquePeriods.size;
    
    // calculate free score
    const staffReserves = reserves.filter(r => r.staff_id === s.id);
    const actualFreeScore = staffReserves.length;
    
    if (s.current_score !== actualScore || s.free_staff_score !== actualFreeScore) {
      console.log(`Staff ${s.name} out of sync! Expected score: ${actualScore}, got ${s.current_score}. Expected free score: ${actualFreeScore}, got ${s.free_staff_score}.`);
      outOfSync = true;
      
      // Auto-fix
      await supabase.from('staff').update({ current_score: actualScore, free_staff_score: actualFreeScore }).eq('id', s.id);
      console.log(`Fixed scores for ${s.name}`);
    }
  }
  
  if (!outOfSync) console.log("All scores are perfectly in sync!");
}

main().catch(console.error);
