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

const DEFAULT_PASSWORD = 'Control@2026';

const accountsToCreate = [];

// PharmD Control (1 to 5)
for (let i = 1; i <= 5; i++) {
  accountsToCreate.push({
    email: `c-phd-${i}@horus.edu.eg`,
    name: `PharmD Control ${i}`,
    type: 'pharmd'
  });
}

// PharmD Clinical Control (1 to 5)
for (let i = 1; i <= 5; i++) {
  accountsToCreate.push({
    email: `c-phd-c-${i}@horus.edu.eg`,
    name: `PharmD Clinical Control ${i}`,
    type: 'pharmd_clinical'
  });
}

async function createControlAccounts() {
  console.log(`Creating ${accountsToCreate.length} Control accounts...`);

  let createdCount = 0;
  let existCount = 0;
  let errorCount = 0;

  for (const account of accountsToCreate) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: {
          role: 'control',
          name: account.name,
          control_type: account.type
        }
      });

      if (error) {
        if (error.message.includes('already been registered')) {
          console.log(`Account already exists: ${account.email}`);
          existCount++;
        } else {
          console.error(`Error creating account ${account.email}:`, error.message);
          errorCount++;
        }
      } else {
        console.log(`Created account: ${account.email}`);
        createdCount++;
      }
    } catch (err) {
      console.error(`Exception creating account ${account.email}:`, err.message);
      errorCount++;
    }
  }

  console.log('--- Summary ---');
  console.log(`Created: ${createdCount}`);
  console.log(`Already Existed: ${existCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Password for all accounts: ${DEFAULT_PASSWORD}`);
}

createControlAccounts();
