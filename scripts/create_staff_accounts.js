const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let supabaseServiceKey = '';

envFile.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    supabaseServiceKey = line.split('=')[1].trim();
  }
});

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const DEFAULT_PASSWORD = 'Horus@2026';

async function createStaffAccounts() {
  console.log('Fetching staff list...');
  const { data: staffList, error: fetchError } = await supabase
    .from('staff')
    .select('*');

  if (fetchError) {
    console.error('Error fetching staff:', fetchError);
    return;
  }

  console.log(`Found ${staffList.length} staff members. Creating accounts...`);

  let createdCount = 0;
  let existCount = 0;
  let errorCount = 0;

  for (const staff of staffList) {
    if (!staff.email) {
      console.log(`Skipping ${staff.name} - No email address.`);
      continue;
    }

    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: staff.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: {
          role: 'staff',
          staff_id: staff.id,
          name: staff.name
        }
      });

      if (error) {
        if (error.message.includes('already been registered')) {
          console.log(`Account already exists for ${staff.email}`);
          existCount++;
        } else {
          console.error(`Error creating account for ${staff.email}:`, error.message);
          errorCount++;
        }
      } else {
        console.log(`Created account for ${staff.email}`);
        createdCount++;
      }
    } catch (err) {
      console.error(`Exception creating account for ${staff.email}:`, err.message);
      errorCount++;
    }
  }

  console.log('--- Summary ---');
  console.log(`Total staff processed: ${staffList.length}`);
  console.log(`Created: ${createdCount}`);
  console.log(`Already Existed: ${existCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Default Password for new accounts: ${DEFAULT_PASSWORD}`);
}

createStaffAccounts();
