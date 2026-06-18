require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const hods = [
  { email: "msalim@horus.edu.eg", name: "Dr. M Salim" },
  { email: "agamal@horus.edu.eg", name: "Dr. A Gamal" },
  { email: "ahassan@horus.edu.eg", name: "Dr. A Hassan" },
  { email: "aelgaml@horus.edu.eg", name: "Dr. A Elgaml" },
  { email: "helewa@horus.edu.eg", name: "Dr. H Elewa" },
  { email: "afares@horus.edu.eg", name: "Dr. A Fares" }
];

async function createHODs() {
  for (const hod of hods) {
    console.log(`Processing ${hod.email}...`);

    // Create Auth User
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: hod.email,
      password: 'Horus@2026',
      email_confirm: true,
      user_metadata: {
        role: 'hod',
        name: hod.name
      }
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log(`Auth account already exists for ${hod.email}`);
        
        // Ensure the role is updated if it already exists
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const user = existingUsers.users.find(u => u.email === hod.email.toLowerCase());
        
        if (user) {
           await supabase.auth.admin.updateUserById(user.id, {
             user_metadata: { ...user.user_metadata, role: 'hod', name: hod.name }
           });
           console.log(`Updated Auth Account role to 'hod' for ${hod.email}`);
        }
      } else {
        console.error(`Error creating auth user for ${hod.email}:`, authError.message);
      }
    } else {
      console.log(`Created Auth Account for ${hod.email}!`);
    }
  }
}

createHODs().catch(console.error);
