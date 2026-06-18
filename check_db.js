require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkDb() {
  const { data, error } = await supabase
    .from('assignments')
    .select('exam_session_id, exam_sessions(exam_date)');
    
  if (error) {
    console.error(error);
    return;
  }
  
  const counts = {};
  data.forEach(a => {
    const date = a.exam_sessions?.exam_date || 'unknown';
    counts[date] = (counts[date] || 0) + 1;
  });
  
  console.log("Assignments per date:", counts);
}

checkDb();
