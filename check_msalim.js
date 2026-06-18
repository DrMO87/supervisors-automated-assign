require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAccount() {
  // Check if staff member exists in staff table
  const { data: staff, error: staffErr } = await supabase
    .from('staff')
    .select('email')
    .ilike('email', 'msalim%');
  
  console.log("Staff table results:", staff);

  // Check auth.users (can only be done with admin api if we have service_role)
  try {
    const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
    if (userErr) throw userErr;
    
    const msalimUser = users.users.find(u => u.email.includes('msalim'));
    console.log("Auth user found:", msalimUser ? msalimUser.email : "Not found in Auth");
  } catch(e) {
    console.log("Could not fetch auth users (maybe no service_role key):", e.message);
  }
}

checkAccount().catch(console.error);
