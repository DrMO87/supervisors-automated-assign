const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('.env.local file not found');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Checking database table structure...');

  // 1. Check if column free_staff_score exists on staff table
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('*')
    .limit(1);

  if (staffError) {
    console.error('Error fetching staff:', staffError);
  } else if (staffData && staffData.length > 0) {
    const hasCol = 'free_staff_score' in staffData[0];
    console.log(`Column 'free_staff_score' exists on staff: ${hasCol}`);
    console.log('Staff keys:', Object.keys(staffData[0]));
  } else {
    console.log('Staff table is empty or could not be queried');
  }

  // 2. Check if table period_free_staff exists
  const { data: freeStaffData, error: freeStaffError } = await supabase
    .from('period_free_staff')
    .select('*')
    .limit(1);

  if (freeStaffError) {
    console.log(`Table 'period_free_staff' query failed (likely does not exist):`, freeStaffError.message);
  } else {
    console.log(`Table 'period_free_staff' exists! Rows: ${freeStaffData.length}`);
  }
}

check();
