const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://chauqwnfzjskbucoppwb.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_80BAZpxQpqVr6z50lv-H-Q_yxnCO97c';
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function getPeriodFromTime(startTime) {
  if (!startTime) return 1;
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  const startMinutesAt8AM = 8 * 60;
  const diff = totalMinutes - startMinutesAt8AM;
  if (diff < 0) return 1;
  return Math.floor(diff / 180) + 1;
}

async function debug() {
  const startStr = "2026-06-07";
  const endStr = "2026-06-14";

  const [{ data: sessions }, { data: staff }, { data: existingAssignments }] = await Promise.all([
    supabaseAdmin.from('exam_sessions').select('*').gte('exam_date', startStr).lt('exam_date', endStr).limit(10000),
    supabaseAdmin.from('staff').select('*').limit(10000),
    supabaseAdmin.from('assignments').select('*').limit(10000)
  ]);

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

    const assignmentsInGroup = existingAssignments.filter(a => group.session_ids.includes(a.exam_session_id));
    const assignedStaffIds = new Set(assignmentsInGroup.map(a => a.staff_id));

    console.log(`\n=== Staff assigned in ${key} ===`);
    for (const id of assignedStaffIds) {
        const s = staff.find(st => st.id === id);
        console.log(`- ${s ? s.name : id}`);
    }
  }
}
debug().catch(console.error);
