const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
let supabaseUrl = '';
let supabaseKey = '';

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/);
  const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim();
  if (keyMatch) supabaseKey = keyMatch[1].trim();
} catch (e) {
  console.error("Error reading .env.local", e);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking staff table columns...");
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('*')
    .limit(1);

  if (staffError) {
    console.error("Error fetching staff:", staffError);
  } else {
    console.log("Staff record columns:", staffData.length > 0 ? Object.keys(staffData[0]) : "No records in staff table");
  }

  console.log("Checking if period_free_staff table exists...");
  const { data: pfsData, error: pfsError } = await supabase
    .from('period_free_staff')
    .select('*')
    .limit(1);

  if (pfsError) {
    console.log("period_free_staff table does not exist or error:", pfsError.message);
  } else {
    console.log("period_free_staff table exists. Columns:", pfsData.length > 0 ? Object.keys(pfsData[0]) : "No records");
  }
}

run();
