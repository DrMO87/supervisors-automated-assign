require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function restore() {
  console.log("Loading Excel file...");
  const filePath = 'C:\\Users\\dell\\Downloads\\weekly_schedule_report_2026-06-12 (1).xlsx';
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets['Schedule View'];
  const rows = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`Found ${rows.length} rows in Schedule View.`);

  // Load all staff to map names to IDs
  console.log("Fetching staff from DB...");
  const { data: staffData, error: staffErr } = await supabase.from('staff').select('id, name, supervision_role');
  if (staffErr) throw staffErr;
  const nameToStaffId = {};
  staffData.forEach(s => {
    // Normalize spaces and names just in case
    const normalizedDbName = s.name.trim().replace(/\s+/g, ' ');
    nameToStaffId[normalizedDbName] = s.id;
  });

  // Load all exam sessions for this week to map details to session ID
  // Wait, let's just fetch all sessions and filter
  console.log("Fetching exam sessions...");
  const { data: sessions, error: sessionsErr } = await supabase
    .from('exam_sessions')
    .select('*')
    .gte('exam_date', '2026-06-12')
    .lte('exam_date', '2026-06-18');
  if (sessionsErr) throw sessionsErr;

  console.log("Fetching rooms...");
  const { data: rooms, error: roomsErr } = await supabase.from('rooms').select('id, room_name');
  if (roomsErr) throw roomsErr;
  const roomMap = {};
  rooms.forEach(r => roomMap[r.id] = r.room_name);

  // attach room names
  sessions.forEach(s => s.room_name = roomMap[s.room_id]);

  let insertData = [];
  let unmatchedStaff = new Set();
  let unmatchedSessions = 0;

  for (let row of rows) {
    // Find session
    const date = row['Date'];
    const time = row['Time'];
    const roomName = row['Room'];
    const subject = row['Subject'];
    const examType = row['Exam Type'];
    
    // Convert time format if needed (Excel might have "10:00:00" or similar)
    const session = sessions.find(s => 
      s.exam_date === date && 
      s.start_time === time &&
      (s.room_name === roomName || (!s.room_name && !roomName))
    );

    if (!session) {
      if (unmatchedSessions === 0) {
        console.log("Debug: First unmatched row:", {date, time, roomName, subject, examType});
        console.log("Available DB sessions sample:", sessions.slice(0,2).map(s => ({
          exam_date: s.exam_date, start_time: s.start_time, room_name: s.room_name, subject: s.subject
        })));
      }
      unmatchedSessions++;
      continue;
    }

    // Map staff roles
    const rolesToMap = [
      { col: 'Committees Supervisor', role: 'Committees_Supervisor' },
      { col: 'Exam Supervisor', role: 'Exam_Supervisor' },
      { col: 'Invigilator 1', role: 'Invigilator' },
      { col: 'Invigilator 2', role: 'Invigilator' },
      { col: 'Invigilator 3', role: 'Invigilator' },
      { col: 'Invigilator 4', role: 'Invigilator' },
      { col: 'Invigilator 5', role: 'Invigilator' },
    ];

    for (let r of rolesToMap) {
      const staffName = row[r.col];
      if (staffName && typeof staffName === 'string' && staffName !== '— EMPTY —' && !staffName.includes('✓')) {
        // Find staff
        let staffId = nameToStaffId[staffName.trim().replace(/\s+/g, ' ')];
        if (!staffId) {
          unmatchedStaff.add(staffName);
        } else {
          insertData.push({
            exam_session_id: session.id,
            staff_id: staffId,
            role: r.role,
            is_manual_override: true,
            assigned_at: new Date().toISOString()
          });
        }
      }
    }
  }

  console.log(`\n=== DRY RUN RESULTS ===`);
  console.log(`Total Assignments to Insert: ${insertData.length}`);
  console.log(`Unmatched Sessions: ${unmatchedSessions}`);
  if (unmatchedStaff.size > 0) {
    console.log(`Unmatched Staff Names:`, Array.from(unmatchedStaff));
  } else {
    console.log(`All staff names matched successfully!`);
  }
  
  if (unmatchedSessions === 0 && unmatchedStaff.size === 0) {
    console.log("\nEverything matched. Executing ACTUAL INSERT...");
    
    // Deduplicate payload
    const uniqueMap = new Map();
    for (const item of insertData) {
      uniqueMap.set(`${item.exam_session_id}_${item.staff_id}`, item);
    }
    const deduplicatedData = Array.from(uniqueMap.values());
    console.log(`Deduplicated from ${insertData.length} to ${deduplicatedData.length} assignments.`);

    // Batch insert/upsert to handle duplicates
    const { data: result, error: insertErr } = await supabase
      .from('assignments')
      .upsert(deduplicatedData, { onConflict: 'exam_session_id, staff_id' });
      
    if (insertErr) {
      console.error("Failed to insert assignments:", insertErr);
    }
  }
}

restore().catch(console.error);
