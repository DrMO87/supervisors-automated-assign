require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fillVacantOrals() {
  // 1. Get vacant oral sessions before June 20
  const { data: sessions, error } = await supabase
    .from('exam_sessions')
    .select(`
      id, subject_name, room_id, start_time, exam_date,
      assignments ( id, staff_id )
    `)
    .lt('exam_date', '2026-06-20')
    .eq('exam_type', 'Oral');
    
  if (error) throw error;
  
  const vacantSessions = sessions.filter(s => s.assignments.length === 0);
  console.log(`Found ${vacantSessions.length} vacant oral sessions on June 6`);
  
  // 2. Get Chemists
  const { data: chemists } = await supabase
    .from('staff')
    .select('id, name')
    .ilike('job_title', '%Chemist%')
    .eq('availability_status', 'Available');
    
  // 3. Assign free chemists to vacant sessions
  // Need to ensure they aren't double booked!
  const { data: existingAssignments } = await supabase
    .from('assignments')
    .select('*, exam_sessions!inner(exam_date, start_time)')
    .lt('exam_sessions.exam_date', '2026-06-20');
    
  const getPeriod = (time) => {
    const [h] = time.split(':');
    return parseInt(h) < 12 ? 1 : (parseInt(h) < 15 ? 2 : 3);
  };
  
  let chemistIndex = 0;
  const newAssignments = [];
  
  for (const session of vacantSessions) {
    const period = getPeriod(session.start_time);
    
    // Find a free chemist
    let assigned = false;
    for (let i = 0; i < chemists.length; i++) {
      const idx = (chemistIndex + i) % chemists.length;
      const chemist = chemists[idx];
      
      // Check if chemist is busy this period on this date
      const isBusy = existingAssignments.some(a => 
        a.staff_id === chemist.id && 
        a.exam_sessions.exam_date === session.exam_date &&
        getPeriod(a.exam_sessions.start_time) === period
      );
      
      if (!isBusy) {
        newAssignments.push({
          exam_session_id: session.id,
          staff_id: chemist.id,
          role: 'Invigilator',
          is_manual_override: true,
          assigned_at: new Date().toISOString()
        });
        
        // Mark as busy
        existingAssignments.push({
          staff_id: chemist.id,
          exam_sessions: { exam_date: session.exam_date, start_time: session.start_time }
        });
        
        chemistIndex = idx + 1;
        assigned = true;
        console.log(`Assigned ${chemist.name} to ${session.subject_name}`);
        break;
      }
    }
    
    if (!assigned) {
      console.log(`COULD NOT FIND FREE CHEMIST for ${session.subject_name}`);
    }
  }
  
  if (newAssignments.length > 0) {
    const { error: insertError } = await supabase.from('assignments').insert(newAssignments);
    if (insertError) throw insertError;
    console.log(`Successfully inserted ${newAssignments.length} assignments.`);
  }
}
fillVacantOrals();
