require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkMissing() {
  const { data: sessions, error } = await supabase
    .from('exam_sessions')
    .select(`
      id, subject_name, room_id,
      assignments ( id, staff_id, role, staff:staff_id(name) )
    `)
    .eq('exam_date', '2026-06-06')
    .eq('exam_type', 'Oral');
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log("June 6th Oral Exams:");
  sessions.forEach(s => {
    console.log(`- ${s.subject_name} (Room ID: ${s.room_id}): ${s.assignments.length} assignments`);
    s.assignments.forEach(a => console.log(`  * ${a.staff?.name} (${a.role})`));
  });
}
checkMissing();
