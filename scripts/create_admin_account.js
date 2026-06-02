require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function createAdmin() {
  const email = 'admin@horus.edu.eg';
  const password = 'HorusAdmin2026!';
  
  console.log(`Creating account for ${email}...`);
  
  const { data, error } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: {
      role: 'admin_reports',
      name: 'Reports Administrator'
    }
  });

  if (error) {
    console.error('Error creating admin account:', error.message);
  } else {
    console.log('Success! UID:', data.user.id);
  }
}

createAdmin().catch(console.error);
