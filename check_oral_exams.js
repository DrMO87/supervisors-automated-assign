require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('exam_sessions')
    .select('id, exam_date, start_time, exam_type')
    .eq('exam_type', 'Oral');
    
  if (error) console.error(error);
  else {
    const dates = [...new Set(data.map(d => d.exam_date))].sort();
    console.log("Dates with Oral Exams:", dates);
    
    // For June 13
    const june13 = data.filter(d => d.exam_date === '2026-06-13');
    console.log("Oral Exams on 2026-06-13:");
    
    const times = [...new Set(june13.map(d => d.start_time))].sort();
    console.log("Start times on 2026-06-13:", times);
  }
}

check().catch(console.error);
