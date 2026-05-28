const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.cwd(), 'data');
const staffData = JSON.parse(fs.readFileSync(path.join(dataDir, 'staff.json'), 'utf-8'));
const examData = JSON.parse(fs.readFileSync(path.join(dataDir, 'exam_sessions.json'), 'utf-8'));
const assignmentsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'assignments.json'), 'utf-8'));

function checkAvailability(dateStr, roleStr) {
  const dayOfWeek = new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long' });
  
  // Find staff with the target role
  const roleStaff = staffData.filter(s => s.supervision_role === roleStr);
  
  // How many are available on dateStr?
  const availableStaff = roleStaff.filter(s => {
    if (s.availability_status !== 'Available') return false;
    if (s.specific_off_dates && s.specific_off_dates.includes(dateStr)) return false;
    if (s.working_days && !s.working_days.includes(dayOfWeek)) return false;
    return true;
  });

  // Exams on this date
  const dateExams = examData.filter(e => e.exam_date === dateStr);
  
  // Group exams by period (start_time)
  const periods = [...new Set(dateExams.map(e => e.start_time))].sort();

  console.log(`\n=== CHECKING ${dateStr} (${dayOfWeek}) FOR ${roleStr} ===`);
  console.log(`Total staff with role ${roleStr}: ${roleStaff.length}`);
  console.log(`Available on this day: ${availableStaff.length} (${availableStaff.map(s => s.name).join(', ')})`);
  
  console.log(`\nExams by period:`);
  periods.forEach(time => {
    const periodExams = dateExams.filter(e => e.start_time === time);
    // Which of our available staff are assigned in this period?
    const assignmentsInPeriod = assignmentsData.filter(a => {
      const exam = dateExams.find(e => e.id === a.exam_session_id);
      return exam && exam.start_time === time;
    });

    const roleAssignments = assignmentsInPeriod.filter(a => a.role === roleStr.replace(' ', '_'));
    const staffAssigned = roleAssignments.map(a => staffData.find(s => s.id === a.staff_id)?.name);

    console.log(`- Period ${time}: ${periodExams.length} rooms`);
    console.log(`  Assigned ${roleStr}s: ${staffAssigned.length} (${staffAssigned.join(', ')})`);
  });
}

checkAvailability('2026-05-31', 'Exam Supervisor');
checkAvailability('2026-06-01', 'Committees Supervisor');
