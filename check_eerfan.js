require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAccount() {
  console.log("Checking staff table...");
  const { data: staff, error: staffErr } = await supabase
    .from('staff')
    .select('*')
    .or('email.ilike.%eerfan%,name.ilike.%eerfan%,name.ilike.%Eerfan%');
  
  if (staffErr) {
    console.error("Staff Error:", staffErr);
  } else {
    console.log("Staff table results:", staff);
  }

  console.log("\nChecking auth.users...");
  try {
    const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
    if (userErr) throw userErr;
    
    const matches = users.users.filter(u => 
      (u.email && u.email.toLowerCase().includes('eerfan')) ||
      (u.user_metadata && u.user_metadata.name && u.user_metadata.name.toLowerCase().includes('eerfan'))
    );
    console.log("Auth user found:", matches);
  } catch(e) {
    console.log("Could not fetch auth users:", e.message);
  }
}

checkAccount().catch(console.error);
