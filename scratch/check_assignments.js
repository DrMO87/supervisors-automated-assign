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
  console.log("Fetching exam sessions for May 23 and May 24, 2026...");
  
  // Fetch sessions using *
  const { data: sessions, error: sessionsError } = await supabase
    .from('exam_sessions')
    .select(`
      *,
      rooms (
        id,
        room_name
      )
    `)
    .in('exam_date', ['2026-05-23', '2026-05-24'])
    .order('exam_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (sessionsError) {
    console.error("Error fetching sessions:", sessionsError);
    return;
  }

  console.log(`Fetched ${sessions.length} sessions.`);

  // Fetch all assignments for these sessions
  const sessionIds = sessions.map(s => s.id);
  
  if (sessionIds.length === 0) {
    console.log("No sessions found in the database for those dates.");
    return;
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from('assignments')
    .select(`
      *,
      staff (
        id,
        name,
        job_title
      )
    `)
    .in('exam_session_id', sessionIds);

  if (assignmentsError) {
    console.error("Error fetching assignments:", assignmentsError);
    return;
  }

  console.log(`Fetched ${assignments.length} assignments.`);

  // Group assignments by session ID
  const assignmentsBySession = {};
  assignments.forEach(a => {
    if (!assignmentsBySession[a.exam_session_id]) {
      assignmentsBySession[a.exam_session_id] = [];
    }
    assignmentsBySession[a.exam_session_id].push(a);
  });

  // Map and print the sessions and their assignments
  const results = sessions.map(s => {
    const sessionAssignments = assignmentsBySession[s.id] || [];
    
    // Group staff by role
    const roles = {};
    sessionAssignments.forEach(a => {
      const roleName = a.role;
      const staffName = a.staff ? a.staff.name : 'Unknown';
      if (!roles[roleName]) roles[roleName] = [];
      roles[roleName].push(staffName);
    });

    return {
      id: s.id,
      subject: s.subject_name,
      date: s.exam_date,
      start_time: s.start_time,
      end_time: s.end_time,
      room: s.rooms ? s.rooms.room_name : 'No Room',
      student_count: s.student_count,
      roles: roles
    };
  });

  // Output to a file so we can view it cleanly if it is large
  const outputPath = path.join(__dirname, 'db_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Saved output to ${outputPath}`);
  console.log(`Summary of first 3 results:`, JSON.stringify(results.slice(0, 3), null, 2));
}

run();
