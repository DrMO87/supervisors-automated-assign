require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fix() {
  const { data: staff, error } = await supabase
    .from('staff')
    .select('*')
    .ilike('job_title', '%Chemist%');
    
  console.log(`Found ${staff.length} Chemists:`);
  staff.forEach(s => console.log(s.name, s.job_title));
}
fix();
