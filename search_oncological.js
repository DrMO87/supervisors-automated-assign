require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function search() {
  const { data, error } = await supabase
    .from('exam_sessions')
    .select('id, subject_name, exam_date, exam_type')
    .ilike('subject_name', '%Oncological%');
    
  if (error) console.error(error);
  console.log(data);
}
search();
