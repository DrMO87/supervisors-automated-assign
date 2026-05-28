const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
  if (match) {
    let key = match[1];
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: 'SELECT 1;' });
  if (error) {
    console.log("exec_sql RPC is not available or failed:", error.message);
  } else {
    console.log("exec_sql RPC is available! Result:", data);
  }
}

run();
