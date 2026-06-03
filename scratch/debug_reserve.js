const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://chauqwnfzjskbucoppwb.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_80BAZpxQpqVr6z50lv-H-Q_yxnCO97c';
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

async function debug() {
  const startStr = "2026-06-07";
  const endStr = "2026-06-14";

  const [{ data: sessions }, { data: staff }, { data: existingAssignments }] = await Promise.all([
    supabaseAdmin.from('exam_sessions').select('*').gte('exam_date', startStr).lt('exam_date', endStr).limit(10000),
    supabaseAdmin.from('staff').select('*').limit(10000),
    supabaseAdmin.from('assignments').select('*').limit(10000)
  ]);

  console.log(`Fetched ${sessions.length} sessions`);
  console.log(`Fetched ${staff.length} staff`);
  console.log(`Fetched ${existingAssignments.length} assignments`);

  const datePeriodGroups = new Map();
  for (const session of sessions) {
    const period = getPeriodFromTime(session.start_time);
    const key = `${session.exam_date}_${period}`;
    if (!datePeriodGroups.has(key)) {
      datePeriodGroups.set(key, { exam_date: session.exam_date, period, session_ids: [] });
    }
    datePeriodGroups.get(key).session_ids.push(session.id);
  }

  for (const [key, group] of datePeriodGroups.entries()) {
    if (group.exam_date !== '2026-06-07' || group.period !== 1) continue;

    console.log(`\n=== Group: ${key} ===`);
    console.log(`Session IDs count: ${group.session_ids.length}`);
    
    // Find missing sessions
    // Some assignments might point to a session not in group.session_ids?
    const assignmentsInPeriod = existingAssignments.filter(a => {
        const s = sessions.find(s => s.id === a.exam_session_id);
        if (!s) return false;
        return s.exam_date === group.exam_date && getPeriodFromTime(s.start_time) === group.period;
    });

    console.log(`Assignments that SHOULD be in this period: ${assignmentsInPeriod.length}`);

    const assignmentsInGroup = currentAssignments = existingAssignments.filter(a => group.session_ids.includes(a.exam_session_id));
    console.log(`Assignments actually IN group.session_ids: ${assignmentsInGroup.length}`);

    const assignedStaffIds = new Set(assignmentsInGroup.map(a => a.staff_id));
    console.log(`Unique assigned staff IDs in group: ${assignedStaffIds.size}`);

    const staffNamesToCheck = ['محمد', 'ندى', 'إسراء', 'رحمه', 'غاده'];
    
    for (const name of staffNamesToCheck) {
        const s = staff.find(st => st.name.includes(name));
        if (!s) continue;
        
        console.log(`\nChecking staff: ${s.name} (ID: ${s.id})`);
        console.log(`Is in assignedStaffIds? ${assignedStaffIds.has(s.id)}`);
        
        const a = existingAssignments.find(a => a.staff_id === s.id);
        if (a) {
            console.log(`Found assignment for ${s.name}: session_id=${a.exam_session_id}, role=${a.role}`);
            const sess = sessions.find(sess => sess.id === a.exam_session_id);
            if (sess) {
                console.log(`Session details: date=${sess.exam_date}, start_time=${sess.start_time}, period=${getPeriodFromTime(sess.start_time)}`);
                console.log(`Is session in group.session_ids? ${group.session_ids.includes(sess.id)}`);
            } else {
                console.log(`Session NOT FOUND in fetched sessions!`);
            }
        } else {
            console.log(`NO ASSIGNMENT FOUND IN DB for ${s.name}!`);
        }
    }
  }
}

debug().catch(console.error);
