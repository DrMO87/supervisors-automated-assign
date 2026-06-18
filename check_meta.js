require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  const msalim = users.find(u => u.email === 'msalim@horus.edu.eg');
  console.log("Metadata:", msalim.user_metadata);
}

check().catch(console.error);
