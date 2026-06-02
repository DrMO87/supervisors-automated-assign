import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function recalculateScores() {
  console.log("Recalculating staff scores based on role...");
  
  const { data: allAssignments, error: aError } = await supabaseAdmin.from('assignments').select('staff_id, exam_session_id');
  const { data: allSessions, error: sError } = await supabaseAdmin.from('exam_sessions').select('id, exam_date, start_time');
  
  if (aError) { console.error("Error fetching assignments:", aError); return; }
  if (sError) { console.error("Error fetching sessions:", sError); return; }
  
  const staffScores = new Map();
  
  allAssignments.forEach(a => {
    if (!staffScores.has(a.staff_id)) staffScores.set(a.staff_id, new Set());
    
    const session = allSessions.find(s => s.id === a.exam_session_id);
    if (session) {
      staffScores.get(a.staff_id).add(`${session.exam_date}_${session.start_time}`);
    }
  });
  
  const { data: allStaff, error: stError } = await supabaseAdmin.from('staff').select('id, current_score, name');
  if (stError) { console.error("Error fetching staff:", stError); return; }
  
  let updatedCount = 0;
  
  for (const st of allStaff) {
    const newScore = staffScores.get(st.id)?.size || 0;
    
    if (st.current_score !== newScore) {
      console.log(`Updating ${st.name}: ${st.current_score} -> ${newScore}`);
      await supabaseAdmin.from('staff').update({ current_score: newScore }).eq('id', st.id);
      updatedCount++;
    }
  }
  
  console.log(`\nFinished recalculating. Updated ${updatedCount} staff members.`);
}

recalculateScores();
