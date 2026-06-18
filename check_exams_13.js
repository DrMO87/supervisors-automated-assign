require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('exam_sessions')
    .select('id, exam_date, start_time, exam_type, subject_name')
    .eq('exam_date', '2026-06-13');
    
  if (error) console.error(error);
  else {
    console.log("Exams on 2026-06-13:", data.length);
    if (data.length > 0) {
      console.log("Types found:", [...new Set(data.map(d => d.exam_type))]);
      console.log("Sample:", data.slice(0, 5));
    }
  }
}

check().catch(console.error);
