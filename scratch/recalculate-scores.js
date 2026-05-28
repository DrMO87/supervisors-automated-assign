const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually to get Supabase credentials
const dotenvPath = path.join(__dirname, '..', '.env.local');
let env = {};
try {
  const content = fs.readFileSync(dotenvPath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] ? match[2].trim() : '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      env[match[1]] = value;
    }
  });
} catch (e) {
  console.error("Error reading .env.local file:", e);
  process.exit(1);
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper to get period from time
function getPeriodFromTime(startTime) {
  if (!startTime) return 1;
  try {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const startMinutesAt8AM = 8 * 60;
    const diff = totalMinutes - startMinutesAt8AM;
    if (diff < 0) return 1;
    return Math.floor(diff / 180) + 1;
  } catch (e) {
    return 1;
  }
}

async function recalculate() {
  console.log("Fetching all staff...");
  const { data: staffList, error: staffError } = await supabase.from('staff').select('*');
  if (staffError) {
    console.error("Error fetching staff:", staffError);
    process.exit(1);
  }

  console.log("Fetching all assignments...");
  const { data: assignments, error: assignmentsError } = await supabase.from('assignments').select('*');
  if (assignmentsError) {
    console.error("Error fetching assignments:", assignmentsError);
    process.exit(1);
  }

  console.log("Fetching all exam sessions...");
  const { data: sessions, error: sessionsError } = await supabase.from('exam_sessions').select('*');
  if (sessionsError) {
    console.error("Error fetching sessions:", sessionsError);
    process.exit(1);
  }

  console.log(`Loaded ${staffList.length} staff, ${assignments.length} assignments, ${sessions.length} sessions.`);

  // Calculate unique periods for each staff member
  const staffNewPeriods = new Map();
  staffList.forEach(s => {
    staffNewPeriods.set(s.id, new Set());
  });

  assignments.forEach(a => {
    const session = sessions.find(s => s.id === a.exam_session_id);
    if (session) {
      const periodKey = `${session.exam_date}__${getPeriodFromTime(session.start_time)}`;
      if (!staffNewPeriods.has(a.staff_id)) {
        staffNewPeriods.set(a.staff_id, new Set());
      }
      staffNewPeriods.get(a.staff_id).add(periodKey);
    }
  });

  // Perform updates
  console.log("Updating staff scores...");
  let updatedCount = 0;
  for (const staffMember of staffList) {
    const periods = staffNewPeriods.get(staffMember.id) || new Set();
    const targetScore = periods.size;

    if (staffMember.current_score !== targetScore) {
      console.log(`Updating ${staffMember.name}: ${staffMember.current_score} -> ${targetScore}`);
      const { error: updateError } = await supabase
        .from('staff')
        .update({ current_score: targetScore })
        .eq('id', staffMember.id);
      
      if (updateError) {
        console.error(`Failed to update ${staffMember.name}:`, updateError);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`Recalculation complete. Updated ${updatedCount} staff scores.`);
}

recalculate();
