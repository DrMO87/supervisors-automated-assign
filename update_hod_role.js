require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const HOD_EMAILS = [
  "msalim@horus.edu.eg",
  "agamal@horus.edu.eg",
  "ahassan@horus.edu.eg",
  "aelgaml@horus.edu.eg",
  "helewa@horus.edu.eg",
  "afares@horus.edu.eg"
];

async function updateRoles() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Error fetching users:", error);
    return;
  }

  for (const user of users) {
    if (user.email && HOD_EMAILS.includes(user.email.toLowerCase())) {
      console.log(`Updating role for ${user.email} to 'hod'...`);
      const updatedMetadata = { ...user.user_metadata, role: 'hod' };
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: updatedMetadata
      });
      if (updateError) {
        console.error(`Failed to update ${user.email}:`, updateError);
      } else {
        console.log(`Success: ${user.email}`);
      }
    }
  }
}

updateRoles().catch(console.error);
