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
  // Let's query these two exam sessions
  const { data: sessions, error } = await supabase
    .from('exam_sessions')
    .select(`
      *,
      rooms ( room_name )
    `)
    .in('id', ['2e22fbb0-6f83-4cff-8c05-916315286a08', 'f409d205-04fb-4457-a8e3-36c4f8c1644c']);

  if (error) {
    console.error("Error fetching sessions:", error);
    return;
  }

  console.log("Sessions detail:");
  console.log(JSON.stringify(sessions, null, 2));

  // Query assignments for these two sessions
  const { data: assignments, error: assError } = await supabase
    .from('assignments')
    .select(`
      *,
      staff ( name )
    `)
    .in('exam_session_id', ['2e22fbb0-6f83-4cff-8c05-916315286a08', 'f409d205-04fb-4457-a8e3-36c4f8c1644c']);

  if (assError) {
    console.error("Error fetching assignments:", assError);
    return;
  }

  console.log("\nAssignments detail:");
  console.log(JSON.stringify(assignments, null, 2));
}

run();
