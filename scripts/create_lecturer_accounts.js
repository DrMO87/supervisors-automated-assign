require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAccounts() {
  console.log("Fetching Lecturers...");
  
  const { data: staff, error: fetchError } = await supabase
    .from('staff')
    .select('id, name, email')
    .eq('job_title', 'Lecturer')
    .not('email', 'is', null)
    .neq('email', '');

  if (fetchError) {
    console.error("Error fetching staff:", fetchError);
    process.exit(1);
  }

  console.log(`Found ${staff.length} lecturers with emails.`);

  let createdCount = 0;
  let errorCount = 0;

  for (const member of staff) {
    try {
      console.log(`Creating account for ${member.name} (${member.email})...`);
      
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: member.email,
        password: 'Horus2026!',
        email_confirm: true,
        user_metadata: {
          role: 'staff',
          staff_id: member.id, // Store staff ID for easy matching later
          name: member.name
        }
      });

      if (authError) {
        if (authError.message.includes("User already registered")) {
          console.log(`  -> Already exists. Updating metadata...`);
          
          // Optionally update metadata if already exists
          const { data: usersData } = await supabase.auth.admin.listUsers();
          const existingUser = usersData.users.find(u => u.email === member.email);
          if (existingUser) {
             await supabase.auth.admin.updateUserById(existingUser.id, {
               user_metadata: { role: 'staff', staff_id: member.id, name: member.name }
             });
             console.log(`  -> Metadata updated.`);
          }
        } else {
          console.error(`  -> Failed: ${authError.message}`);
          errorCount++;
        }
      } else {
        console.log(`  -> Success! UID: ${authData.user.id}`);
        createdCount++;
      }
    } catch (err) {
      console.error(`  -> Exception: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\nFinished! Created: ${createdCount}, Errors: ${errorCount}`);
}

createAccounts();
