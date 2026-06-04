import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import type { Staff, ExamSessionWithRelations, AssignmentWithSession, Room, Assignment, ExamSession, SchedulingConstraintsConfig, PeriodFreeStaff } from '@/types/database.types';
import { getPeriodFromTime, getDurationInMinutes } from '@/types/database.types';
import { computeFreeInvigilatorsReport, type WeeklyFreeReport, type PeriodFreePool } from './free-invigilators';
import { LOGO_DTU_BASE64, LOGO_PHARMACY_BASE64, LOGO_HUE_BASE64, LOGO_SESSION_MASTER_BASE64 } from './logo-base64';

// Helper for formatting roles accurately
const getRoleLabel = (role: string) => {
  if (role === 'Exam_Supervisor') return 'Exam Supervisor';
  if (role === 'Head_Supervisor' || role === 'Committees_Supervisor') return 'ComSupervisor';
  return 'Invigilator';
};

const getShortRole = (role: string) => {
  if (role === 'Exam_Supervisor') return 'ExSuper';
  if (role === 'Head_Supervisor' || role === 'Committees_Supervisor') return 'ComSupervisor';
  return 'Inv';
};

// ==================== BRANDING & LAYOUT ====================

const REPORT_BRANDING = `
  <div class="report-header">
    <div class="logo-container">
      <img src="${LOGO_HUE_BASE64}" class="logo-hue" height="68" style="height: 68px; max-height: 68px; width: auto; object-fit: contain;" alt="Horus University Egypt" />
      <img src="${LOGO_PHARMACY_BASE64}" class="logo-pharmacy" height="68" style="height: 68px; max-height: 68px; width: auto; object-fit: contain;" alt="Faculty of Pharmacy" />
      <img src="${LOGO_DTU_BASE64}" class="logo-dtu" height="68" style="height: 68px; max-height: 68px; width: auto; object-fit: contain;" alt="Digital Transformation Unit" />
      <img src="${LOGO_SESSION_MASTER_BASE64}" class="logo-sm" height="68" style="height: 68px; max-height: 68px; width: auto; object-fit: contain;" alt="Session Master" />
    </div>
    <div class="header-credits">
      Full Stack Developed by <span>Prof. Mahmoud Elkhoudary</span>
      <div class="credits-title">Head of Digital Transformation Unit - Faculty of Pharmacy</div>
    </div>
  </div>
`;

const REPORT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap');

  @page {
    size: A4 portrait;
    margin: 10mm;
  }
  body { 
    font-family: 'Cairo', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
    margin: 0; 
    padding: 0; 
    color: #1e293b;
    line-height: 1.4;
    background: white;
  }
  .report-page {
    width: 100%;
    max-width: 210mm;
    margin: 0 auto;
  }
  .report-header {
    border-bottom: 2pt solid #002147;
    padding-bottom: 4mm;
    margin-bottom: 6mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3mm;
  }
  .logo-container {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8mm;
  }
  .logo-container img {
    height: 18mm;
    object-fit: contain;
  }
  .header-credits {
    text-align: center;
    font-size: 9pt;
    color: #475569;
    font-weight: 500;
    margin-top: 1mm;
  }
  .header-credits span {
    color: #002147;
    font-weight: 700;
  }
  .credits-title {
    font-size: 8pt;
    color: #64748b;
    margin-top: 0.5mm;
    font-weight: 400;
  }
  
  h1 { 
    margin: 6mm 0 8mm 0;
    font-size: 24pt;
    font-weight: 800;
    color: #002147;
    text-align: center;
  }
  .report-meta {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 4mm;
    border-radius: 2mm;
    margin-bottom: 6mm;
    font-size: 10pt;
  }
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2mm 8mm;
  }
  .meta-item strong { color: #475569; font-weight: 600; }

  
    tr.day-separator > td {
      border-top: 3px solid #1e293b !important;
    }
    tr.period-separator > td {
      border-top: 2px dashed #94a3b8 !important;
    }
    tr.oral-exam-row > td {
      background-color: #fefce8 !important;
    }

    table { 
    width: 100%; 
    border-collapse: collapse; 
    margin-top: 4mm;
    font-size: 9pt;
  }
  th { 
    background: #002147; 
    color: #FFB81C; 
    text-align: left;
    padding: 3mm;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 8.5pt;
    letter-spacing: 0.3pt;
    border-bottom: 2px solid #FFB81C;
  }
  td { 
    border-bottom: 0.5pt solid #e2e8f0; 
    padding: 3mm;
    vertical-align: top;
  }
  tr:nth-child(even) { background: #fcfdfe; }
  
  /* Highlight First Column */
  td:first-child {
    background-color: #f8fafc;
    font-weight: 700;
    color: #002147;
    border-left: 3px solid #FFB81C;
  }
  th:first-child {
    border-left: 3px solid #FFB81C;
  }
  tr:nth-child(even) td:first-child {
    background-color: #f1f5f9;
  }

  .role-badge {
    font-size: 8pt;
    font-weight: 700;
    border-radius: 1mm;
    display: inline-block;
  }
  .footer {
    margin-top: 15mm;
    padding-top: 4mm;
    border-top: 0.5pt solid #e2e8f0;
    font-size: 8pt;
    color: #64748b;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer-left, .footer-right {
    width: 25%;
  }
  .footer-right {
    text-align: right;
  }
  .footer-center {
    width: 50%;
    text-align: center;
    font-size: 8.5pt;
    color: #475569;
  }
  .footer-center strong {
    color: #002147;
    font-weight: 700;
  }
  
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
`;

function getReportLayout(title: string, content: string, meta?: string, displayTitle?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>${REPORT_STYLES}</style>
</head>
<body>
  <div class="report-page">
    ${REPORT_BRANDING}
    <h1>${displayTitle || title}</h1>
    ${meta || ''}
    <div class="report-content">
      ${content}
    </div>
    <div class="footer">
      <div class="footer-left">Generated on ${format(new Date(), 'PPpp')}</div>
      <div class="footer-center">Developed by <strong>Prof. Mahmoud Elkhoudary</strong> (Head of Digital Transformation Unit)</div>
      <div class="footer-right">Page 1 of 1</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate staff workload statistics Excel
 */
export function generateWorkloadExcel(staff: Staff[], assignments: AssignmentWithSession[]): Blob {
  const headers = ['Name', 'Email', 'Job Title', 'Employment Status', 'Availability', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Current Score', 'Free Score', 'Total Score', 'Total Assignments', 'Exam Supervisor', 'Comm Sprv', 'Invigilator'];

  const rows = staff.map(s => {
    const staffAssignments = assignments.filter(a => a.staff_id === s.id);
    
    const uniqueSlots = new Set<string>();
    const uniqueExamSlots = new Set<string>();
    const uniqueCommSlots = new Set<string>();
    const uniqueInvigSlots = new Set<string>();

    staffAssignments.forEach(a => {
      if (!a.exam_session) return;
      const date = a.exam_session.exam_date;
      const period = getPeriodFromTime(a.exam_session.start_time);
      const roomId = a.exam_session.room_id;

      if (a.role === 'Head_Supervisor' || a.role === 'Committees_Supervisor') {
        uniqueSlots.add(`${date}_${period}`);
        uniqueCommSlots.add(`${date}_${period}`);
      } else if (a.role === 'Exam_Supervisor') {
        uniqueSlots.add(`${date}_${period}_${roomId}`);
        uniqueExamSlots.add(`${date}_${period}_${roomId}`);
      } else if (a.role === 'Assistant' || a.role === 'Invigilator') {
        uniqueSlots.add(`${date}_${period}_${roomId}`);
        uniqueInvigSlots.add(`${date}_${period}_${roomId}`);
      }
    });

    const isWorking = (day: string) => s.working_days?.includes(day) ? 'Yes' : 'No';

    return [
      s.name,
      s.email,
      s.job_title,
      s.employment_status,
      s.availability_status,
      isWorking('Saturday'),
      isWorking('Sunday'),
      isWorking('Monday'),
      isWorking('Tuesday'),
      isWorking('Wednesday'),
      isWorking('Thursday'),
      s.current_score.toString(),
      (s.free_staff_score || 0).toString(),
      ((s.current_score || 0) + (s.free_staff_score || 0)).toString(),
      uniqueSlots.size.toString(),
      uniqueExamSlots.size.toString(),
      uniqueCommSlots.size.toString(),
      uniqueInvigSlots.size.toString(),
    ];
  });

  const data = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Workload Stats");
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Generate daily hall sheet Excel
 */
export function generateDailyHallExcel(exams: ExamSessionWithRelations[], date: string): Blob {
  const dayExams = exams
    .filter(e => e.exam_date === date)
    .sort((a, b) => {
      const pA = getPeriodFromTime(a.start_time);
    const pB = getPeriodFromTime(b.start_time);
    if (pA !== pB) return pA - pB;
    const isOralA = a.exam_type === 'Oral' ? 1 : 0;
    const isOralB = b.exam_type === 'Oral' ? 1 : 0;
    if (isOralA !== isOralB) return isOralA - isOralB;
    return (a.room?.room_name || '').localeCompare(b.room?.room_name || '');
    });

  const headers = ['Room', 'Period', 'Start Time', 'Subject', 'Program', 'Exam Type', 'Students', 'Committees Supervisor', 'Exam Supervisor', 'Invigilator 1', 'Invigilator 2', 'Invigilator 3', 'Invigilator 4'];

  const rows = dayExams.map((exam, i, arr) => {
    let sep = '';
    if (i > 0) {
      const prev = arr[i-1];
      if (getPeriodFromTime(prev.start_time) !== getPeriodFromTime(exam.start_time)) sep = ' class="period-separator"';
    }
    
    const commSupervisors = exam.assignments?.filter(a => a.role === 'Committees_Supervisor').map(a => a.staff?.name).join('; ') || '';
    const examSupervisors = exam.assignments?.filter(a => a.role === 'Exam_Supervisor').map(a => a.staff?.name).join('; ') || '';
    const invigilators = exam.assignments?.filter(a => a.role === 'Invigilator').map(a => a.staff?.name) || [];
    
    const inv1 = invigilators[0] || '';
    const inv2 = invigilators[1] || '';
    const inv3 = invigilators[2] || '';
    const inv4 = invigilators[3] || '';

    return [
      exam.room?.room_name || '',
      `Period ${getPeriodFromTime(exam.start_time)}`,
      exam.start_time,
      exam.subject_name,
      exam.program || '-',
      exam.exam_type || '-',
      exam.student_count.toString(),
      commSupervisors,
      examSupervisors,
      inv1,
      inv2,
      inv3,
      inv4,
    ];
  });

  const data = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Hall Sheet ${date}`);
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Generate staff schedule Excel
 */
export function generateStaffScheduleExcel(staff: Staff, assignments: AssignmentWithSession[], weekLabel?: string): Blob {
  const showTeam = staff.supervision_role === 'Committees Supervisor' || staff.supervision_role === 'Exam Supervisor';
  const headers = showTeam
    ? ['Date', 'Period', 'Time From', 'Time To', 'Subject', 'Program', 'Exam Type', 'Room', 'Students', 'Role', 'Duration (min)', 'Supervision Team']
    : ['Date', 'Period', 'Time From', 'Time To', 'Subject', 'Program', 'Exam Type', 'Room', 'Students', 'Role', 'Duration (min)'];

  const staffAssignments = assignments
    .filter(a => a.staff_id === staff.id && a.exam_session)
    .sort((a, b) => {
      const dateCompare = (a.exam_session?.exam_date || '').localeCompare(b.exam_session?.exam_date || '');
      if (dateCompare !== 0) return dateCompare;
      return getPeriodFromTime(a.exam_session?.start_time || '') - getPeriodFromTime(b.exam_session?.start_time || '');
    });

  // Group assignments to avoid showing duplicates for concurrent sessions in the same room
  const groupedAssignments: { [key: string]: AssignmentWithSession[] } = {};
  for (const a of staffAssignments) {
    const exam = a.exam_session!;
    const period = getPeriodFromTime(exam.start_time);
    const key = `${exam.exam_date}_${period}_${exam.room_id}`;
    if (!groupedAssignments[key]) groupedAssignments[key] = [];
    groupedAssignments[key].push(a);
  }

  const processedKeys = new Set<string>();
  const consolidatedAssignments: AssignmentWithSession[][] = [];
  for (const a of staffAssignments) {
    const exam = a.exam_session!;
    const period = getPeriodFromTime(exam.start_time);
    const key = `${exam.exam_date}_${period}_${exam.room_id}`;
    if (!processedKeys.has(key)) {
      processedKeys.add(key);
      consolidatedAssignments.push(groupedAssignments[key]);
    }
  }

  const rows = consolidatedAssignments.map((group, i, arr) => {
    let sep = '';
    if (i > 0) {
      const prev = arr[i-1][0].exam_session!;
      const curr = group[0].exam_session!;
      if (prev.exam_date !== curr.exam_date) sep = ' class="day-separator"';
      else if (getPeriodFromTime(prev.start_time) !== getPeriodFromTime(curr.start_time)) sep = ' class="period-separator"';
    }
    const baseAssignment = group[0];
    const exam = baseAssignment.exam_session!;
    
    // Combine fields if there are multiple sessions in this room/period
    const subjectName = Array.from(new Set(group.map(a => a.exam_session?.subject_name))).filter(Boolean).join(' / ');
    const program = Array.from(new Set(group.map(a => a.exam_session?.program))).filter(Boolean).join(' / ') || '-';
    const examType = Array.from(new Set(group.map(a => a.exam_session?.exam_type))).filter(Boolean).join(' / ') || '-';
    const studentCount = group.reduce((sum, a) => sum + (a.exam_session?.student_count || 0), 0);
    const duration = getDurationInMinutes(exam.start_time, exam.end_time).toString();

    const row = [
      format(new Date(`${exam.exam_date}T12:00:00Z`), 'yyyy-MM-dd'),
      `Period ${getPeriodFromTime(exam.start_time)}`,
      exam.start_time,
      exam.end_time || '-',
      subjectName,
      program,
      examType,
      exam.room?.room_name || '',
      studentCount.toString(),
      getRoleLabel(baseAssignment.role),
      duration,
    ];

    if (showTeam) {
      const team = assignments
        .filter(allA => group.some(ga => ga.exam_session_id === allA.exam_session_id))
        .reduce((acc, curr) => {
          if (!acc.find(x => x.staff_id === curr.staff_id)) acc.push(curr);
          return acc;
        }, [] as typeof assignments)
        .map(allA => `${allA.staff?.name || 'Unknown'} (${getRoleLabel(allA.role)})`)
        .join('; ');
      row.push(team);
    }
    return row;
  });

  const data = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  const sheetName = (weekLabel ? `Schedule ${weekLabel}` : "Staff Schedule").substring(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Generate room schedule Excel
 */
export function generateRoomScheduleExcel(room: Room, exams: ExamSessionWithRelations[]): Blob {
  const headers = ['Date', 'Period', 'Time', 'Subject', 'Program', 'Exam Type', 'Students', 'Committees Supervisor', 'Exam Supervisor', 'Invigilator 1', 'Invigilator 2', 'Invigilator 3', 'Invigilator 4'];
  
  const roomExams = exams
    .filter(e => e.room_id === room.id)
    .sort((a, b) => {
      const dateCompare = a.exam_date.localeCompare(b.exam_date);
      if (dateCompare !== 0) return dateCompare;
      return getPeriodFromTime(a.start_time) - getPeriodFromTime(b.start_time);
    });

  const rows = roomExams.map((exam, i, arr) => {
    let sep = '';
    if (i > 0) {
      const prev = arr[i-1];
      if (prev.exam_date !== exam.exam_date) sep = ' class="day-separator"';
      else if (getPeriodFromTime(prev.start_time) !== getPeriodFromTime(exam.start_time)) sep = ' class="period-separator"';
    }
    
    const commSupervisors = exam.assignments?.filter(a => a.role === 'Committees_Supervisor').map(a => a.staff?.name).join('; ') || '';
    const examSupervisors = exam.assignments?.filter(a => a.role === 'Exam_Supervisor').map(a => a.staff?.name).join('; ') || '';
    const invigilators = exam.assignments?.filter(a => a.role === 'Invigilator').map(a => a.staff?.name) || [];
    
    const inv1 = invigilators[0] || '';
    const inv2 = invigilators[1] || '';
    const inv3 = invigilators[2] || '';
    const inv4 = invigilators[3] || '';

    return [
      format(new Date(`${exam.exam_date}T12:00:00Z`), 'yyyy-MM-dd'),
      `Period ${getPeriodFromTime(exam.start_time)}`,
      exam.start_time,
      exam.subject_name,
      exam.program || '-',
      exam.exam_type || '-',
      exam.student_count.toString(),
      commSupervisors,
      examSupervisors,
      inv1,
      inv2,
      inv3,
      inv4,
    ];
  });

  const data = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Room ${room.room_name}`);
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ==================== PRINT-FRIENDLY HTML GENERATORS ====================

/**
 * Generate printable staff schedule HTML
 */
export function generateStaffScheduleHTML(staff: Staff, assignments: AssignmentWithSession[], weekLabel?: string): string {
  const showTeam = staff.supervision_role === 'Committees Supervisor' || staff.supervision_role === 'Exam Supervisor';
  const staffAssignments = assignments
    .filter(a => a.staff_id === staff.id && a.exam_session)
    .sort((a, b) => {
      const dateCompare = (a.exam_session?.exam_date || '').localeCompare(b.exam_session?.exam_date || '');
      if (dateCompare !== 0) return dateCompare;
      return getPeriodFromTime(a.exam_session?.start_time || '') - getPeriodFromTime(b.exam_session?.start_time || '');
    });

  // Group assignments to avoid showing duplicates for concurrent sessions in the same room
  const groupedAssignments: { [key: string]: AssignmentWithSession[] } = {};
  for (const a of staffAssignments) {
    const exam = a.exam_session!;
    const period = getPeriodFromTime(exam.start_time);
    const key = `${exam.exam_date}_${period}_${exam.room_id}`;
    if (!groupedAssignments[key]) groupedAssignments[key] = [];
    groupedAssignments[key].push(a);
  }

  const processedKeys = new Set<string>();
  const consolidatedAssignments: AssignmentWithSession[][] = [];
  for (const a of staffAssignments) {
    const exam = a.exam_session!;
    const period = getPeriodFromTime(exam.start_time);
    const key = `${exam.exam_date}_${period}_${exam.room_id}`;
    if (!processedKeys.has(key)) {
      processedKeys.add(key);
      consolidatedAssignments.push(groupedAssignments[key]);
    }
  }

  const CHUNK_SIZE = 20; // Safe limit for Outlook's Word rendering engine (22 inch height limit per table)
  const tables: string[] = [];

  const tableHeader = `
    <thead>
      <tr>
        <th>Date</th>
        <th>Period</th>
        <th>Time From</th>
        <th>Time To</th>
        <th>Subject / Course</th><th>Program</th><th>Exam Type</th>
        <th>Exam Hall</th>
        <th style="text-align:center">Students</th>
        <th>Assigned Role</th>
        ${showTeam ? '<th>Supervision Team</th>' : ''}
      </tr>
    </thead>
  `;

  if (consolidatedAssignments.length === 0) {
    tables.push(`
      <table>
        ${tableHeader}
        <tbody>
          <tr><td colspan="${showTeam ? 11 : 10}" style="text-align:center;padding:20mm;color:#94a3b8">No assignments found for this period.</td></tr>
        </tbody>
      </table>
    `);
  } else {
    for (let i = 0; i < consolidatedAssignments.length; i += CHUNK_SIZE) {
      const chunk = consolidatedAssignments.slice(i, i + CHUNK_SIZE);
      
      const rows = chunk.map((group, idx, arr) => {
        let sep = '';
        if (idx > 0) {
          const prev = arr[idx-1][0].exam_session!;
          const curr = group[0].exam_session!;
          if (prev.exam_date !== curr.exam_date) sep = ' class="day-separator"';
          else if (getPeriodFromTime(prev.start_time) !== getPeriodFromTime(curr.start_time)) sep = ' class="period-separator"';
        }
        const baseAssignment = group[0];
        const exam = baseAssignment.exam_session!;
        
        const subjectName = Array.from(new Set(group.map(a => a.exam_session?.subject_name))).filter(Boolean).join(' / ');
        const program = Array.from(new Set(group.map(a => a.exam_session?.program))).filter(Boolean).join(' / ') || '-';
        const examType = Array.from(new Set(group.map(a => a.exam_session?.exam_type))).filter(Boolean).join(' / ') || '-';
        const studentCount = group.reduce((sum, a) => sum + (a.exam_session?.student_count || 0), 0);

        const teamHTML = showTeam
          ? `<td>${
              assignments
                .filter(allA => group.some(ga => ga.exam_session_id === allA.exam_session_id))
                .reduce((acc, curr) => {
                  if (!acc.find(x => x.staff_id === curr.staff_id)) acc.push(curr);
                  return acc;
                }, [] as typeof assignments)
                .map(allA => `<div style="margin-bottom:0.5mm"><strong>${allA.staff?.name || 'Unknown'}</strong> <small>(${getShortRole(allA.role)})</small></div>`)
                .join('') || '<em>None</em>'
            }</td>`
          : '';

        return `<tr${sep}>
          <td>${format(new Date(`${exam.exam_date}T12:00:00Z`), 'EEE, MMM d, yyyy')}</td>
          <td>Period ${getPeriodFromTime(exam.start_time)}</td>
          <td>${exam.start_time}</td>
          <td>${exam.end_time || '-'}</td>
          <td>${subjectName}</td><td>${program}</td><td>${examType}</td>
          <td>${exam.room?.room_name || '-'}</td>
          <td style="text-align:center">${studentCount}</td>
          <td><strong>${getRoleLabel(baseAssignment.role)}</strong></td>
          ${teamHTML}
        </tr>`;
      }).join('');

      tables.push(`
        <table style="margin-bottom: 20px; page-break-inside: avoid; border-collapse: collapse; width: 100%;">
          ${tableHeader}
          <tbody>
            ${rows}
          </tbody>
        </table>
      `);
    }
  }

  const table = tables.join('');

  const title = weekLabel ? `${staff.name} - ${weekLabel.toUpperCase()}` : `${staff.name}`;
  const displayTitle = weekLabel 
    ? `<span dir="rtl">${staff.name}</span> - <span dir="ltr">${weekLabel.toUpperCase()}</span>`
    : `<span dir="rtl">${staff.name}</span>`;
  return getReportLayout(title, table, meta, displayTitle);
}

/**
 * Generate printable daily hall sheet HTML
 */
export function generateDailyHallHTML(exams: ExamSessionWithRelations[], date: string): string {
  const dayExams = exams
    .filter(e => e.exam_date === date)
    .sort((a, b) => {
      const pA = getPeriodFromTime(a.start_time);
    const pB = getPeriodFromTime(b.start_time);
    if (pA !== pB) return pA - pB;
    const isOralA = a.exam_type === 'Oral' ? 1 : 0;
    const isOralB = b.exam_type === 'Oral' ? 1 : 0;
    if (isOralA !== isOralB) return isOralA - isOralB;
    return (a.room?.room_name || '').localeCompare(b.room?.room_name || '');
    });

  const rows = dayExams.map((exam, i, arr) => {
    let sep = '';
    if (i > 0) {
      const prev = arr[i-1];
      if (getPeriodFromTime(prev.start_time) !== getPeriodFromTime(exam.start_time)) sep = ' class="period-separator"';
    }
    const supervisors = exam.assignments?.map(a =>
      `<div style="margin-bottom:1mm"><strong>${a.staff?.name || 'Unknown'}</strong> <small>(${getShortRole(a.role)})</small></div>`
    ).join('') || '<em>Not assigned</em>';

    return `<tr${sep}>
      <td><strong>${exam.room?.room_name || '-'}</strong></td>
      <td>Period ${getPeriodFromTime(exam.start_time)}<br><small>${exam.start_time}</small></td>
      <td>${exam.subject_name}</td><td>${exam.program || '-'}</td><td>${exam.exam_type || '-'}</td>
      <td style="text-align:center">${exam.student_count}</td>
      <td style="text-align:center">${getDurationInMinutes(exam.start_time, exam.end_time)} min</td>
      <td>${supervisors}</td>
    </tr>`;
  }).join('');

  const formattedDate = format(new Date(`${date}T12:00:00Z`), 'EEEE, MMMM d, yyyy');

  const meta = `
    <div class="report-meta">
      <div class="meta-grid">
        <div class="meta-item"><strong>Date:</strong> ${formattedDate}</div>
        <div class="meta-item"><strong>Total Halls:</strong> ${dayExams.length}</div>
      </div>
    </div>
  `;

  const table = `
    <table>
      <thead>
        <tr>
          <th style="width:15%">Hall / Room</th>
          <th style="width:15%">Slot / Time</th>
          <th style="width:20%">Subject</th><th>Program</th><th>Exam Type</th>
          <th style="width:10%;text-align:center">Students</th>
          <th style="width:10%;text-align:center">Dur.</th>
          <th style="width:25%">Supervision Team</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="8" style="text-align:center;padding:20mm;color:#94a3b8">No exams scheduled for this date.</td></tr>'}
      </tbody>
    </table>
  `;

  return getReportLayout(`HALL SHEET: ${date}`, table, meta);
}

/**
 * Generate printable room schedule HTML
 */
export function generateRoomScheduleHTML(room: Room, exams: ExamSessionWithRelations[]): string {
  const roomExams = exams
    .filter(e => e.room_id === room.id)
    .sort((a, b) => {
      const dateCompare = a.exam_date.localeCompare(b.exam_date);
      if (dateCompare !== 0) return dateCompare;
      return getPeriodFromTime(a.start_time) - getPeriodFromTime(b.start_time);
    });

  const rows = roomExams.map((exam, i, arr) => {
    let sep = '';
    if (i > 0) {
      const prev = arr[i-1];
      if (prev.exam_date !== exam.exam_date) sep = ' class="day-separator"';
      else if (getPeriodFromTime(prev.start_time) !== getPeriodFromTime(exam.start_time)) sep = ' class="period-separator"';
    }
    const supervisors = exam.assignments?.map(a =>
      `<div style="margin-bottom:0.5mm"><strong>${a.staff?.name || 'Unknown'}</strong> <small>(${getShortRole(a.role)})</small></div>`
    ).join('') || '<em>Not assigned</em>';

    return `<tr${sep}>
      <td>${format(new Date(`${exam.exam_date}T12:00:00Z`), 'EEE, MMM d, yyyy')}</td>
      <td>Period ${getPeriodFromTime(exam.start_time)}</td>
      <td>${exam.start_time}</td>
      <td>${exam.subject_name}</td><td>${exam.program || '-'}</td><td>${exam.exam_type || '-'}</td>
      <td style="text-align:center">${exam.student_count}</td>
      <td>${supervisors}</td>
    </tr>`;
  }).join('');

  const meta = `
    <div class="report-meta">
      <div class="meta-grid">
        <div class="meta-item"><strong>Hall/Room:</strong> ${room.room_name}</div>
        <div class="meta-item"><strong>Building:</strong> ${room.building_code || room.building || 'N/A'}</div>
        <div class="meta-item"><strong>Floor:</strong> ${room.floor ?? 'N/A'}</div>
        <div class="meta-item"><strong>Capacity:</strong> ${room.max_capacity} Students</div>
      </div>
    </div>
  `;

  const table = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Period</th>
          <th>Time</th>
          <th>Subject</th><th>Program</th><th>Exam Type</th>
          <th style="text-align:center">Students</th>
          <th>Supervisors</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="8" style="text-align:center;padding:20mm;color:#94a3b8">No sessions scheduled for this hall.</td></tr>'}
      </tbody>
    </table>
  `;

  return getReportLayout(`${room.room_name.toUpperCase()}`, table, meta);
}

/**
 * Generate printable weekly hall report HTML
 */
export function generateWeeklyHallHTML(exams: ExamSessionWithRelations[], weekLabel?: string, freeStaffList?: PeriodFreeStaff[]): string {
  const sortedExams = [...exams].sort((a, b) => {
    const dateCompare = a.exam_date.localeCompare(b.exam_date);
    if (dateCompare !== 0) return dateCompare;
    const pA = getPeriodFromTime(a.start_time);
    const pB = getPeriodFromTime(b.start_time);
    if (pA !== pB) return pA - pB;
    const isOralA = a.exam_type === 'Oral' ? 1 : 0;
    const isOralB = b.exam_type === 'Oral' ? 1 : 0;
    if (isOralA !== isOralB) return isOralA - isOralB;
    return (a.room?.room_name || '').localeCompare(b.room?.room_name || '');
  });

  const periodCounts = new Map<string, number>();
  sortedExams.forEach(exam => {
    const key = `${exam.exam_date}_${getPeriodFromTime(exam.start_time)}`;
    periodCounts.set(key, (periodCounts.get(key) || 0) + 1);
  });

  const periodSeen = new Set<string>();

      const rows = sortedExams.map((exam, i, arr) => {
    let classes = [];
    if (i > 0) {
      const prev = arr[i-1];
      if (prev.exam_date !== exam.exam_date) classes.push('day-separator');
      else if (getPeriodFromTime(prev.start_time) !== getPeriodFromTime(exam.start_time)) classes.push('period-separator');
    }
    if (exam.exam_type === 'Oral') classes.push('oral-exam-row');
    const sep = classes.length > 0 ? ` class="${classes.join(' ')}"` : '';
    const supervisors = exam.assignments?.map(a =>
      `<div style="margin-bottom:0.5mm"><strong>${a.staff?.name || 'Unknown'}</strong> <small>(${getShortRole(a.role)})</small></div>`
    ).join('') || '<em>Not assigned</em>';

    const dateStr = exam.exam_date;
    const period = getPeriodFromTime(exam.start_time);
    const key = `${dateStr}_${period}`;
    const isFirstInPeriod = !periodSeen.has(key);
    
    let freeStaffCell = '';
    if (isFirstInPeriod) {
      periodSeen.add(key);
      const rowSpan = periodCounts.get(key) || 1;
      const periodFreeStaff = freeStaffList?.filter(fs => fs.exam_date === dateStr && fs.period === period) || [];
      const freeStaffHTML = periodFreeStaff.map(fs =>
        `<div style="margin-bottom:0.5mm"><strong>${fs.staff?.name || 'Unknown'}</strong> <small>(${getShortRole(fs.role)})</small></div>`
      ).join('') || '<em>None</em>';
      
      freeStaffCell = `<td rowspan="${rowSpan}" style="vertical-align: middle; background: #f8fafc; border-left: 1px solid #e2e8f0;">${freeStaffHTML}</td>`;
    }

    return `<tr${sep}>
      <td style="white-space:nowrap">${format(new Date(`${exam.exam_date}T12:00:00Z`), 'MMM d, EE')}</td>
      <td style="text-align:center">P${period}</td>
      <td>${exam.start_time}</td>
      <td>${exam.end_time || '-'}</td>
      <td><strong>${exam.room?.room_name || '-'}</strong></td>
      <td style="text-align:center">${exam.student_count}</td>
      <td>${exam.subject_name}</td><td>${exam.program || '-'}</td><td>${exam.exam_type || '-'}</td>
      <td>${supervisors}</td>
      ${freeStaffCell}
    </tr>`;
  }).join('');

  const dateRange = exams.length > 0 
    ? `${format(new Date(`${sortedExams[0].exam_date}T12:00:00Z`), 'MMM d')} - ${format(new Date(`${sortedExams[sortedExams.length-1].exam_date}T12:00:00Z`), 'MMM d, yyyy')}`
    : 'N/A';

  const meta = `
    <div class="report-meta">
      <div class="meta-grid">
        ${weekLabel ? `<div class="meta-item"><strong>Week:</strong> ${weekLabel}</div>` : `<div class="meta-item"><strong>Date Range:</strong> ${dateRange}</div>`}
        <div class="meta-item"><strong>Total Sessions:</strong> ${exams.length}</div>
      </div>
    </div>
  `;

  const table = `
    <table>
      <thead>
        <tr>
          <th style="width:10%">Date</th>
          <th style="width:5%;text-align:center">P</th>
          <th style="width:8%">Time From</th>
          <th style="width:8%">Time To</th>
          <th style="width:10%">Hall</th>
          <th style="width:6%;text-align:center">Students</th>
          <th style="width:18%">Subject</th><th>Program</th><th>Exam Type</th>
          <th style="width:20%">Supervision Team</th>
          <th style="width:15%">Free Staff (Reserves)</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="11" style="text-align:center;padding:20mm;color:#94a3b8">No comprehensive sessions found.</td></tr>'}
      </tbody>
    </table>
  `;

  const title = weekLabel ? `WEEKLY HALL REPORT - ${weekLabel.toUpperCase()}` : `WEEKLY HALL REPORT`;
  return getReportLayout(title, `<style>@page { size: A4 landscape; } .report-page { max-width: 297mm; }</style>` + table, meta);
}

/**
 * Generate weekly hall report Excel
 */
export function generateWeeklyHallExcel(exams: ExamSessionWithRelations[], weekLabel?: string, freeStaffList?: PeriodFreeStaff[]): Blob {
  const headers = ['Date', 'Period', 'Time From', 'Time To', 'Hall', 'Students', 'Subject', 'Program', 'Exam Type', 'Committees Supervisor', 'Exam Supervisor', 'Invigilator 1', 'Invigilator 2', 'Invigilator 3', 'Invigilator 4', 'Free Staff (Reserves)'];
  
  const sortedExams = [...exams].sort((a, b) => {
    const dateCompare = a.exam_date.localeCompare(b.exam_date);
    if (dateCompare !== 0) return dateCompare;
    const pA = getPeriodFromTime(a.start_time);
    const pB = getPeriodFromTime(b.start_time);
    if (pA !== pB) return pA - pB;
    const isOralA = a.exam_type === 'Oral' ? 1 : 0;
    const isOralB = b.exam_type === 'Oral' ? 1 : 0;
    if (isOralA !== isOralB) return isOralA - isOralB;
    return (a.room?.room_name || '').localeCompare(b.room?.room_name || '');
  });

  const rows: string[][] = [];
  const merges: XLSX.Range[] = [];
  
  let currentRow = 1; // Start after headers
  let currentPeriodKey = '';
  let periodStartRow = 1;
  const FREE_STAFF_COL_INDEX = 15;

  sortedExams.forEach((exam, index) => {
    const commSupervisors = exam.assignments?.filter(a => a.role === 'Committees_Supervisor').map(a => a.staff?.name).join('; ') || '';
    const examSupervisors = exam.assignments?.filter(a => a.role === 'Exam_Supervisor').map(a => a.staff?.name).join('; ') || '';
    const invigilators = exam.assignments?.filter(a => a.role === 'Invigilator').map(a => a.staff?.name) || [];
    
    const inv1 = invigilators[0] || '';
    const inv2 = invigilators[1] || '';
    const inv3 = invigilators[2] || '';
    const inv4 = invigilators[3] || '';
    
    const dateStr = exam.exam_date;
    const period = getPeriodFromTime(exam.start_time);
    const key = `${dateStr}_${period}`;

    if (key !== currentPeriodKey) {
      if (currentPeriodKey !== '' && currentRow - 1 > periodStartRow) {
        merges.push({ s: { r: periodStartRow, c: FREE_STAFF_COL_INDEX }, e: { r: currentRow - 1, c: FREE_STAFF_COL_INDEX } });
      }
      currentPeriodKey = key;
      periodStartRow = currentRow;
    }

    const periodFreeStaff = freeStaffList?.filter(fs => fs.exam_date === dateStr && fs.period === period) || [];
    const freeStaffNames = periodFreeStaff.map(fs => `${fs.staff?.name} (${getShortRole(fs.role)})`).join('; ') || 'None';

    rows.push([
      exam.exam_date,
      `Period ${period}`,
      exam.start_time,
      exam.end_time || '-',
      exam.room?.room_name || '',
      exam.student_count.toString(),
      exam.subject_name,
      exam.program || '-',
      exam.exam_type || '-',
      commSupervisors,
      examSupervisors,
      inv1,
      inv2,
      inv3,
      inv4,
      freeStaffNames,
    ]);
    currentRow++;

    if (index === sortedExams.length - 1 && currentRow - 1 > periodStartRow) {
      merges.push({ s: { r: periodStartRow, c: FREE_STAFF_COL_INDEX }, e: { r: currentRow - 1, c: FREE_STAFF_COL_INDEX } });
    }
  });

  const data = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  if (merges.length > 0) {
    worksheet['!merges'] = merges;
  }
  const workbook = XLSX.utils.book_new();
  const sheetName = (weekLabel ? `Weekly Hall ${weekLabel}` : "Weekly Hall Schedule").substring(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Generate a single PDF with all staff schedules
 */
export function generateAllStaffSchedulesHTML(staffList: Staff[], assignments: AssignmentWithSession[], weekLabel?: string): string {
  const styles = `
    ${REPORT_STYLES}
    .staff-report-container { 
      page-break-before: always;
      padding-top: 5mm;
    }
    .staff-report-container:first-child { 
      page-break-before: auto;
      padding-top: 0;
    }
  `;

  // Filter to only include staff with at least one assignment
  const assignedStaff = staffList.filter(staff => 
    assignments.some(a => a.staff_id === staff.id && a.exam_session)
  );

  const reportBlocks = assignedStaff.map(staff => {
    const showTeam = staff.supervision_role === 'Committees Supervisor' || staff.supervision_role === 'Exam Supervisor';
    const staffAssignments = assignments
      .filter(a => a.staff_id === staff.id && a.exam_session)
      .sort((a, b) => {
        const dateCompare = (a.exam_session?.exam_date || '').localeCompare(b.exam_session?.exam_date || '');
        if (dateCompare !== 0) return dateCompare;
        return getPeriodFromTime(a.exam_session?.start_time || '') - getPeriodFromTime(b.exam_session?.start_time || '');
      });

      // Group assignments to avoid showing duplicates for concurrent sessions in the same room
      const groupedAssignments: { [key: string]: AssignmentWithSession[] } = {};
      for (const a of staffAssignments) {
        const exam = a.exam_session!;
        const period = getPeriodFromTime(exam.start_time);
        const key = `${exam.exam_date}_${period}_${exam.room_id}`;
        if (!groupedAssignments[key]) groupedAssignments[key] = [];
        groupedAssignments[key].push(a);
      }

      const processedKeys = new Set<string>();
      const consolidatedAssignments: AssignmentWithSession[][] = [];
      for (const a of staffAssignments) {
        const exam = a.exam_session!;
        const period = getPeriodFromTime(exam.start_time);
        const key = `${exam.exam_date}_${period}_${exam.room_id}`;
        if (!processedKeys.has(key)) {
          processedKeys.add(key);
          consolidatedAssignments.push(groupedAssignments[key]);
        }
      }

      const rows = consolidatedAssignments.map((group, i, arr) => {
        let sep = '';
        if (i > 0) {
          const prev = arr[i-1][0].exam_session!;
          const curr = group[0].exam_session!;
          if (prev.exam_date !== curr.exam_date) sep = ' class="day-separator"';
          else if (getPeriodFromTime(prev.start_time) !== getPeriodFromTime(curr.start_time)) sep = ' class="period-separator"';
        }
        const baseAssignment = group[0];
        const exam = baseAssignment.exam_session!;
        
        // Combine fields if there are multiple sessions in this room/period
        const subjectName = Array.from(new Set(group.map(a => a.exam_session?.subject_name))).filter(Boolean).join(' / ');
        const program = Array.from(new Set(group.map(a => a.exam_session?.program))).filter(Boolean).join(' / ') || '-';
        const examType = Array.from(new Set(group.map(a => a.exam_session?.exam_type))).filter(Boolean).join(' / ') || '-';
        const studentCount = group.reduce((sum, a) => sum + (a.exam_session?.student_count || 0), 0);

        const teamHTML = showTeam
          ? `<td>${
              assignments
                .filter(allA => group.some(ga => ga.exam_session_id === allA.exam_session_id))
                .reduce((acc, curr) => {
                  if (!acc.find(x => x.staff_id === curr.staff_id)) acc.push(curr);
                  return acc;
                }, [] as typeof assignments)
                .map(allA => `<div style="margin-bottom:0.5mm"><strong>${allA.staff?.name || 'Unknown'}</strong> <small>(${getShortRole(allA.role)})</small></div>`)
                .join('') || '<em>None</em>'
            }</td>`
          : '';

        return `<tr${sep}>
          <td>${format(new Date(`${exam.exam_date}T12:00:00Z`), 'EEE, MMM d, yyyy')}</td>
          <td>Period ${getPeriodFromTime(exam.start_time)}</td>
          <td>${exam.start_time}</td>
          <td>${exam.end_time || '-'}</td>
          <td>${subjectName}</td><td>${program}</td><td>${examType}</td>
          <td>${exam.room?.room_name || '-'}</td>
          <td style="text-align:center">${studentCount}</td>
          <td><strong>${getRoleLabel(baseAssignment.role)}</strong></td>
          ${teamHTML}
        </tr>`;
      }).join('');

    const meta = `
      <div class="report-meta">
        <div class="meta-grid">
          <div class="meta-item"><strong>Staff Name:</strong> ${staff.name}</div>
          <div class="meta-item"><strong>Job Title:</strong> ${staff.job_title}</div>
          <div class="meta-item"><strong>Email:</strong> ${staff.email}</div>
          <div class="meta-item"><strong>Employment:</strong> ${staff.employment_status}</div>
          ${weekLabel ? `<div class="meta-item"><strong>Week:</strong> ${weekLabel}</div>` : ''}
        </div>
      </div>
    `;

    const tableHeaders = `<tr>
      <th>Date</th>
      <th>Period</th>
      <th>Time From</th>
      <th>Time To</th>
      <th>Subject / Course</th><th>Program</th><th>Exam Type</th>
      <th>Exam Hall</th>
      <th style="text-align:center">Students</th>
      <th>Assigned Role</th>
      ${showTeam ? '<th>Supervision Team</th>' : ''}
    </tr>`;

    const title = weekLabel ? `${staff.name.toUpperCase()} - ${weekLabel.toUpperCase()}` : `${staff.name.toUpperCase()}`;
    const displayTitle = weekLabel 
      ? `<bdi>${staff.name.toUpperCase()}</bdi> - <bdi>${weekLabel.toUpperCase()}</bdi>`
      : `<bdi>${staff.name.toUpperCase()}</bdi>`;

    return `
      <div class="staff-report-container">
        <div class="report-header text-center mb-6">
          ${REPORT_BRANDING}
          <h1>${displayTitle}</h1>
          ${meta}
        </div>
        <table>
          <thead>
            ${tableHeaders}
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="${showTeam ? 11 : 10}" style="text-align:center;padding:10mm;color:#94a3b8">No assignments found.</td></tr>`}
          </tbody>
        </table>
        <div class="footer" style="margin-top: 10mm;">
          <div class="footer-left">Generated on ${format(new Date(), 'PPpp')}</div>
          <div class="footer-center">Developed by <strong>Prof. Mahmoud Elkhoudary</strong> (Head of Digital Transformation Unit)</div>
          <div class="footer-right">Report for ${staff.name}</div>
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>All Staff Schedules</title><style>${styles}</style></head><body>${reportBlocks}</body></html>`;
}

export function generateAllRoomSchedulesHTML(rooms: Room[], exams: ExamSessionWithRelations[]): string {
  const styles = `
    ${REPORT_STYLES}
    .room-report-container { 
      page-break-before: always;
      padding-top: 5mm;
    }
    .room-report-container:first-child { 
      page-break-before: auto;
      padding-top: 0;
    }
  `;

  // Filter to only include rooms with at least one exam
  const usedRooms = rooms.filter(room => 
    exams.some(e => e.room_id === room.id)
  );

  const reportBlocks = usedRooms.map(room => {
    const roomExams = exams
      .filter(e => e.room_id === room.id)
      .sort((a, b) => {
        const dateCompare = a.exam_date.localeCompare(b.exam_date);
        if (dateCompare !== 0) return dateCompare;
        return getPeriodFromTime(a.start_time) - getPeriodFromTime(b.start_time);
      });

    const rows = roomExams.map((exam, i, arr) => {
    let sep = '';
    if (i > 0) {
      const prev = arr[i-1];
      if (prev.exam_date !== exam.exam_date) sep = ' class="day-separator"';
      else if (getPeriodFromTime(prev.start_time) !== getPeriodFromTime(exam.start_time)) sep = ' class="period-separator"';
    }
      const supervisors = exam.assignments?.map(a =>
        `<div style="margin-bottom:0.5mm"><strong>${a.staff?.name || 'Unknown'}</strong> <small>(${getShortRole(a.role)})</small></div>`
      ).join('') || '<em>Not assigned</em>';

      return `<tr${sep}>
        <td>${format(new Date(`${exam.exam_date}T12:00:00Z`), 'EEE, MMM d, yyyy')}</td>
        <td>Period ${getPeriodFromTime(exam.start_time)}</td>
        <td>${exam.start_time}</td>
        <td>${exam.subject_name}</td><td>${exam.program || '-'}</td><td>${exam.exam_type || '-'}</td>
        <td style="text-align:center">${exam.student_count}</td>
        <td>${supervisors}</td>
      </tr>`;
    }).join('');

    const meta = `
      <div class="report-meta">
        <div class="meta-grid">
          <div class="meta-item"><strong>Hall/Room:</strong> ${room.room_name}</div>
          <div class="meta-item"><strong>Building:</strong> ${room.building_code || room.building || 'N/A'}</div>
          <div class="meta-item"><strong>Capacity:</strong> ${room.max_capacity} Students</div>
        </div>
      </div>
    `;

    return `
      <div class="room-report-container">
        ${REPORT_BRANDING}
        <h1>HALL: ${room.room_name.toUpperCase()}</h1>
        ${meta}
        <table>
          <thead>
            <tr><th>Date</th><th>Period</th><th>Time</th><th>Subject</th><th>Program</th><th>Exam Type</th><th style="text-align:center">Students</th><th>Supervisors</th></tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="6" style="text-align:center;padding:10mm;color:#94a3b8">No sessions scheduled for this hall.</td></tr>'}
          </tbody>
        </table>
        <div class="footer" style="margin-top: 10mm;">
          <div class="footer-left">Generated on ${format(new Date(), 'PPpp')}</div>
          <div class="footer-center">Developed by <strong>Prof. Mahmoud Elkhoudary</strong> (Head of Digital Transformation Unit)</div>
          <div class="footer-right">Report for Hall ${room.room_name}</div>
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>All Hall Usage Schedules</title><style>${styles}</style></head><body>${reportBlocks}</body></html>`;
}

// ==================== FREE INVIGILATORS REPORT ====================

/**
 * Generate a premium HTML/print report showing free (unassigned) invigilators
 * per exam period, grouped by week.
 *
 * @param allStaff       All staff records
 * @param allSessions    All exam sessions (flat, no relations needed)
 * @param allAssignments All assignments (flat)
 * @param config         Scheduling constraints config
 */
export function generateFreeInvigilatorsHTML(
  allStaff: Staff[],
  allSessions: ExamSession[],
  allAssignments: Assignment[],
  config?: SchedulingConstraintsConfig
): string {
  const weeklyReports = computeFreeInvigilatorsReport(allStaff, allSessions, allAssignments, config);

  const extraStyles = `
    .week-section {
      margin-bottom: 12mm;
      page-break-inside: avoid;
    }
    .week-header {
      background: #002147;
      color: white;
      padding: 3mm 5mm;
      border-radius: 2mm 2mm 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .week-header h2 {
      margin: 0;
      font-size: 12pt;
      font-weight: 700;
      color: white;
      text-transform: none;
    }
    .week-stats {
      display: flex;
      gap: 6mm;
      font-size: 8pt;
      color: #93c5fd;
    }
    .week-stats span { font-weight: 700; color: white; }
    .period-block {
      border: 0.5pt solid #e2e8f0;
      border-top: none;
      margin-bottom: 4mm;
    }
    .period-header {
      background: #f1f5f9;
      padding: 2mm 4mm;
      border-bottom: 0.5pt solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .period-title {
      font-weight: 700;
      font-size: 10pt;
      color: #0f172a;
    }
    .period-meta {
      font-size: 8pt;
      color: #64748b;
    }
    .pill {
      display: inline-block;
      border-radius: 1mm;
      font-size: 7.5pt;
      font-weight: 700;
      padding: 0.5mm 2mm;
    }
    .pill-green { background: #dcfce7; color: #166534; }
    .pill-blue  { background: #dbeafe; color: #1e40af; }
    .pill-orange{ background: #ffedd5; color: #9a3412; }
    .free-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
    }
    .free-table th {
      background: #475569;
      color: white;
      padding: 1.5mm 3mm;
      font-size: 7.5pt;
      text-align: left;
    }
    .free-table td {
      padding: 1.5mm 3mm;
      border-bottom: 0.25pt solid #f1f5f9;
    }
    .free-table tr:nth-child(even) td { background: #f8fafc; }
    .rank-badge {
      display: inline-block;
      background: #002147;
      color: #FFB81C;
      font-size: 7pt;
      font-weight: 800;
      border-radius: 1mm;
      padding: 0 1.5mm;
      min-width: 5mm;
      text-align: center;
    }
    .active-sessions-list {
      font-size: 7.5pt;
      color: #475569;
      padding: 1.5mm 4mm;
      background: #fefce8;
      border-bottom: 0.5pt solid #e2e8f0;
    }
    .summary-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 3mm;
      margin-bottom: 8mm;
    }
    .summary-card {
      background: white;
      border: 0.5pt solid #e2e8f0;
      border-radius: 2mm;
      padding: 3mm;
      text-align: center;
    }
    .summary-card .val {
      font-size: 20pt;
      font-weight: 800;
      color: #002147;
      line-height: 1;
    }
    .summary-card .lbl {
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.5pt;
      color: #94a3b8;
      font-weight: 700;
      margin-top: 1mm;
    }
    .no-data {
      text-align: center;
      padding: 10mm;
      color: #94a3b8;
      font-size: 9pt;
    }
    .role-section-title {
      font-weight: 700;
      font-size: 8.5pt;
      padding: 1.5mm 4mm;
      margin-top: 3mm;
      margin-bottom: 1.5mm;
      border-radius: 1mm;
      text-transform: uppercase;
      letter-spacing: 0.3pt;
    }
    .role-exam {
      background: #f1f5f9;
      color: #0f172a;
      border-left: 3px solid #002147;
    }
    .role-com {
      background: #fef3c7;
      color: #92400e;
      border-left: 3px solid #d97706;
    }
    .role-inv {
      background: #ecfdf5;
      color: #065f46;
      border-left: 3px solid #059669;
    }
    .role-inv-exam {
      background: #e0f2fe;
      color: #075985;
      border-left: 3px solid #0284c7;
    }
  `;

  // Build summary totals
  const totalPeriods   = weeklyReports.reduce((s, w) => s + w.totalPeriods,   0);
  const totalFreeSlots = weeklyReports.reduce((s, w) => s + w.totalFreeSlots, 0);
  const totalExamLoad  = weeklyReports.reduce((s, w) => s + w.examLoad,        0);
  const avgFree        = totalPeriods > 0 ? Math.round((totalFreeSlots / totalPeriods) * 10) / 10 : 0;

  const summaryBar = `
    <div class="summary-bar">
      <div class="summary-card"><div class="val">${weeklyReports.length}</div><div class="lbl">Exam Weeks</div></div>
      <div class="summary-card"><div class="val">${totalPeriods}</div><div class="lbl">Total Periods</div></div>
      <div class="summary-card"><div class="val">${totalExamLoad}</div><div class="lbl">Exam Sessions</div></div>
      <div class="summary-card"><div class="val">${avgFree}</div><div class="lbl">Avg Free / Period</div></div>
    </div>
  `;

  const weekBlocks = weeklyReports.map(week => {
    const periodBlocks = week.periods.map(pool => {
      const { periodKey, activeSessions, freeInvigilators, busyStaff } = pool;
      const dateLabel = format(new Date(periodKey.date), 'EEE, MMM d, yyyy');

      const sessionNames = activeSessions.map(s => s.subject_name).join(' | ');

      const examSupervisors = freeInvigilators.filter(e => e.staff.supervision_role === 'Exam Supervisor');
      const comSupervisors = freeInvigilators.filter(e => e.staff.supervision_role === 'Committees Supervisor');
      const invigilatorExamSupervisors = freeInvigilators.filter(e => e.staff.supervision_role === 'Invigilator / Exam Supervisor');
      const assistants = freeInvigilators.filter(e => 
        e.staff.supervision_role !== 'Exam Supervisor' && 
        e.staff.supervision_role !== 'Committees Supervisor' && 
        e.staff.supervision_role !== 'Invigilator / Exam Supervisor'
      );

      const renderRoleTable = (title: string, entries: typeof freeInvigilators, roleClass: string) => {
        if (entries.length === 0) return '';
        const rows = entries.map((entry, idx) => `
          <tr>
            <td><span class="rank-badge">${idx + 1}</span></td>
            <td><strong>${entry.staff.name}</strong></td>
            <td>${entry.staff.job_title}</td>
            <td>${entry.staff.supervision_role}</td>
            <td style="text-align:center">${entry.weekAssignments}</td>
            <td style="text-align:center">${entry.score}</td>
          </tr>
        `).join('');

        return `
          <div class="role-section-title ${roleClass}">${title} (${entries.length})</div>
          <table class="free-table">
            <thead>
              <tr>
                <th style="width:6%">#</th>
                <th style="width:28%">Name</th>
                <th style="width:20%">Job Title</th>
                <th style="width:22%">Role</th>
                <th style="width:12%;text-align:center">This Week</th>
                <th style="width:12%;text-align:center">Score</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        `;
      };

      const tablesHTML = [
        renderRoleTable('Exam Supervisors', examSupervisors, 'role-exam'),
        renderRoleTable('Committees Supervisors', comSupervisors, 'role-com'),
        renderRoleTable('Invigilators / Exam Supervisors', invigilatorExamSupervisors, 'role-inv-exam'),
        renderRoleTable('Invigilators / Assistants', assistants, 'role-inv')
      ].filter(Boolean).join('');

      return `
        <div class="period-block">
          <div class="period-header">
            <div class="period-title">
              ${dateLabel} &mdash; Period ${periodKey.period}
              <small style="font-weight:400;color:#64748b"> (${periodKey.startTime})</small>
            </div>
            <div class="period-meta">
              <span class="pill pill-blue">${busyStaff.length} Busy</span>&nbsp;
              <span class="pill pill-green">${freeInvigilators.length} Free</span>&nbsp;
              <span class="pill pill-orange">${activeSessions.length} Sessions</span>
            </div>
          </div>
          <div class="active-sessions-list"><strong>Running exams:</strong> ${sessionNames || '—'}</div>
          ${freeInvigilators.length > 0 ? tablesHTML : '<div class="no-data">No free invigilators available for this period.</div>'}
        </div>
      `;
    }).join('');

    return `
      <div class="week-section">
        <div class="week-header">
          <h2>${week.weekLabel}</h2>
          <div class="week-stats">
            <span>Exam Load:</span> ${week.examLoad} sessions &nbsp;|&nbsp;
            <span>Periods:</span> ${week.totalPeriods} &nbsp;|&nbsp;
            <span>Avg Free:</span> ${week.avgFreePerPeriod}
          </div>
        </div>
        ${periodBlocks || '<div class="no-data">No exam periods found for this week.</div>'}
      </div>
    `;
  }).join('');

  const content = `
    ${summaryBar}
    ${weekBlocks || '<div class="no-data" style="padding:20mm">No exam data found.</div>'}
  `;

  const meta = `
    <div class="report-meta">
      <div class="meta-grid">
        <div class="meta-item"><strong>Report Type:</strong> Free Invigilators &amp; Substitution Pool</div>
        <div class="meta-item"><strong>Generated:</strong> ${format(new Date(), 'PPpp')}</div>
        <div class="meta-item"><strong>Total Weeks:</strong> ${weeklyReports.length}</div>
        <div class="meta-item"><strong>Note:</strong> Staff ranked by fewest this-week assignments, then by cumulative score.</div>
      </div>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Free Invigilators Report</title>
  <style>${REPORT_STYLES}${extraStyles}</style>
</head>
<body>
  <div class="report-page">
    ${REPORT_BRANDING}
    <h1>FREE INVIGILATORS REPORT</h1>
    ${meta}
    <div class="report-content">${content}</div>
    <div class="footer">
      <div class="footer-left">Generated on ${format(new Date(), 'PPpp')}</div>
      <div class="footer-center">Developed by <strong>Prof. Mahmoud Elkhoudary</strong> (Head of Digital Transformation Unit)</div>
      <div class="footer-right">Substitution Pool &amp; Availability Report</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate Excel report for free invigilators, with one sheet per week.
 */
export function generateFreeInvigilatorsExcel(
  allStaff: Staff[],
  allSessions: ExamSession[],
  allAssignments: Assignment[],
  config?: SchedulingConstraintsConfig
): Blob {
  const weeklyReports = computeFreeInvigilatorsReport(allStaff, allSessions, allAssignments, config);
  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summaryHeaders = ['Week', 'Exam Load (Sessions)', 'Total Periods', 'Total Free Slots', 'Avg Free / Period'];
  const summaryRows = weeklyReports.map(w => [
    w.weekLabel,
    w.examLoad.toString(),
    w.totalPeriods.toString(),
    w.totalFreeSlots.toString(),
    w.avgFreePerPeriod.toString(),
  ]);
  const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // One sheet per week — all periods + free staff
  weeklyReports.forEach((week, wi) => {
    const headers = [
      'Date', 'Day', 'Period', 'Start Time',
      'Active Sessions',
      'Rank', 'Free Staff Name', 'Job Title', 'Supervision Role',
      'This-Week Assignments', 'Cumulative Score'
    ];
    const rows: string[][] = [];

    for (const pool of week.periods) {
      const { periodKey, activeSessions, freeInvigilators } = pool;
      const dayName = new Date(periodKey.date).toLocaleDateString('en-US', { weekday: 'long' });
      const sessionNames = activeSessions.map(s => s.subject_name).join('; ');

      if (freeInvigilators.length === 0) {
        rows.push([
          periodKey.date, dayName,
          `Period ${periodKey.period}`, periodKey.startTime,
          sessionNames,
          '—', 'No free invigilators', '', '', '', ''
        ]);
      } else {
        freeInvigilators.forEach((entry, idx) => {
          rows.push([
            periodKey.date, dayName,
            `Period ${periodKey.period}`, periodKey.startTime,
            idx === 0 ? sessionNames : '', // only show sessions on first row for this period
            (idx + 1).toString(),
            entry.staff.name,
            entry.staff.job_title,
            entry.staff.supervision_role,
            entry.weekAssignments.toString(),
            entry.score.toString(),
          ]);
        });
      }
    }

    const sheetName = `Week ${wi + 1}`.substring(0, 31);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  // Full flat sheet (all weeks combined)
  const flatHeaders = [
    'Week', 'Date', 'Day', 'Period', 'Start Time',
    'Active Sessions', 'Rank',
    'Free Staff Name', 'Job Title', 'Supervision Role',
    'This-Week Assignments', 'Cumulative Score'
  ];
  const flatRows: string[][] = [];
  for (const week of weeklyReports) {
    for (const pool of week.periods) {
      const { periodKey, activeSessions, freeInvigilators } = pool;
      const dayName = new Date(periodKey.date).toLocaleDateString('en-US', { weekday: 'long' });
      const sessionNames = activeSessions.map(s => s.subject_name).join('; ');
      if (freeInvigilators.length === 0) {
        flatRows.push([
          week.weekLabel, periodKey.date, dayName,
          `Period ${periodKey.period}`, periodKey.startTime,
          sessionNames, '—', 'No free invigilators', '', '', '', ''
        ]);
      } else {
        freeInvigilators.forEach((entry, idx) => {
          flatRows.push([
            week.weekLabel, periodKey.date, dayName,
            `Period ${periodKey.period}`, periodKey.startTime,
            idx === 0 ? sessionNames : '',
            (idx + 1).toString(),
            entry.staff.name,
            entry.staff.job_title,
            entry.staff.supervision_role,
            entry.weekAssignments.toString(),
            entry.score.toString(),
          ]);
        });
      }
    }
  }
  const flatSheet = XLSX.utils.aoa_to_sheet([flatHeaders, ...flatRows]);
  XLSX.utils.book_append_sheet(workbook, flatSheet, 'All Periods');

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Generate PDF blob for a staff schedule using html2canvas and jsPDF to perfectly render Arabic and HTML styling
 */
export async function generateStaffSchedulePDF(staff: Staff, assignments: AssignmentWithSession[], weekLabel?: string): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  const htmlContent = generateStaffScheduleHTML(staff, assignments, weekLabel);
  
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '210mm';
    iframe.style.top = '-9999px';
    document.body.appendChild(iframe);

    iframe.onload = async () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) throw new Error("No iframe document");

        const container = doc.querySelector('.report-page') as HTMLElement;
        if (!container) throw new Error("No report page found");

        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          logging: false
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 0;

        // First page
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;

        // Subsequent pages
        while (heightLeft > 0) {
          position -= pageHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pageHeight;
        }
        
        document.body.removeChild(iframe);
        resolve(pdf.output('blob'));
      } catch (err) {
        document.body.removeChild(iframe);
        reject(err);
      }
    };

    iframe.srcdoc = htmlContent;
  });
}

/**
 * Helper to format a week's date range (e.g. 23-26 MAY 2026) based on assigned dates
 */
export function getWeekRangeLabel(weekStartStr: string, weekAssignments: AssignmentWithSession[]): string {
  if (weekStartStr === 'all') {
    return 'All Weeks';
  }

  const dates = weekAssignments.map(a => a.exam_session?.exam_date).filter(Boolean) as string[];

  if (dates.length === 0) {
    const start = new Date(`${weekStartStr}T12:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 5);

    const startDay = start.getUTCDate();
    const endDay = end.getUTCDate();
    const startMonth = format(start, 'MMM').toUpperCase();
    const endMonth = format(end, 'MMM').toUpperCase();
    const startYear = start.getUTCFullYear();
    const endYear = end.getUTCFullYear();

    if (startMonth === endMonth && startYear === endYear) {
      return `${startDay}-${endDay} ${startMonth} ${startYear}`;
    } else if (startYear === endYear) {
      return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${startYear}`;
    } else {
      return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
    }
  }

  const uniqueDates = Array.from(new Set(dates)).sort();
  const minDate = new Date(`${uniqueDates[0]}T12:00:00Z`);
  const maxDate = new Date(`${uniqueDates[uniqueDates.length - 1]}T12:00:00Z`);

  const startDay = minDate.getUTCDate();
  const endDay = maxDate.getUTCDate();
  const startMonth = format(minDate, 'MMM').toUpperCase();
  const endMonth = format(maxDate, 'MMM').toUpperCase();
  const startYear = minDate.getUTCFullYear();
  const endYear = maxDate.getUTCFullYear();

  if (uniqueDates.length === 1 || (startDay === endDay && startMonth === endMonth && startYear === endYear)) {
    return `${startDay} ${startMonth} ${startYear}`;
  }

  if (startMonth === endMonth && startYear === endYear) {
    return `${startDay}-${endDay} ${startMonth} ${startYear}`;
  } else if (startYear === endYear) {
    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${startYear}`;
  } else {
    return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
  }
}

/**
 * Helper to map period_free_staff records to pseudo-assignments so they automatically render on individual staff PDF/HTML schedules and Excel sheets.
 */
export function mapFreeStaffToAssignment(pfs: PeriodFreeStaff): AssignmentWithSession {
  const endTimeMap: Record<string, string> = {
    '09:00': '11:00',
    '13:00': '15:00',
    '15:45': '17:45'
  };
  return {
    id: pfs.id,
    exam_session_id: `free-${pfs.id}`,
    staff_id: pfs.staff_id,
    role: pfs.role,
    assigned_at: pfs.created_at || new Date().toISOString(),
    assigned_by: null,
    is_manual_override: false,
    staff: pfs.staff,
    exam_session: {
      id: `free-${pfs.id}`,
      subject_name: 'Reserve Duty (Free Staff)',
      exam_date: pfs.exam_date,
      start_time: pfs.start_time,
      end_time: endTimeMap[pfs.start_time] || null,
      student_count: 0,
      room_id: 'reserve',
      exam_type: 'Reserve',
      program: null,
      student_start: null,
      student_end: null,
      is_locked: false,
      created_at: pfs.created_at || new Date().toISOString(),
      updated_at: pfs.created_at || new Date().toISOString(),
      room: {
        id: 'reserve',
        room_name: 'RESERVE',
        max_capacity: 0,
        building: 'RESERVE',
        floor: null,
        is_active: true,
        created_at: pfs.created_at || new Date().toISOString()
      },
      assignments: []
    }
  };
}

export function generateAssignedReservesHTML(freeStaffList: PeriodFreeStaff[], weekLabel?: string): string {
  const sortedStaff = [...freeStaffList].sort((a, b) => {
    const dateCompare = a.exam_date.localeCompare(b.exam_date);
    if (dateCompare !== 0) return dateCompare;
    if (a.period !== b.period) return a.period - b.period;
    return a.role.localeCompare(b.role);
  });

  const periodGroups = new Map<string, PeriodFreeStaff[]>();
  sortedStaff.forEach(fs => {
    const key = `${fs.exam_date}_${fs.period}`;
    if (!periodGroups.has(key)) periodGroups.set(key, []);
    periodGroups.get(key)!.push(fs);
  });

  let rows = '';
  periodGroups.forEach((staffList, key) => {
    const first = staffList[0];
    const assistants = staffList.filter(s => s.role === 'Assistant').map(s => s.staff?.name).join(', ') || 'None';
    const supervisors = staffList.filter(s => (s.role as string) === 'Exam_Supervisor' || (s.role as string) === 'Committees_Supervisor' || (s.role as string) === 'Head_Supervisor').map(s => `${s.staff?.name} (${getShortRole(s.role)})`).join(', ') || 'None';
    
    rows += `<tr>
      <td style="white-space:nowrap">${format(new Date(`${first.exam_date}T12:00:00Z`), 'MMM d, EE')}</td>
      <td style="text-align:center">P${first.period}</td>
      <td>${first.start_time}</td>
      <td><strong>${supervisors}</strong></td>
      <td>${assistants}</td>
    </tr>`;
  });

  const table = `
    <table>
      <thead>
        <tr>
          <th style="width:15%">Date</th>
          <th style="width:10%;text-align:center">Period</th>
          <th style="width:15%">Start Time</th>
          <th style="width:30%">Reserve Exam Supervisors</th>
          <th style="width:30%">Reserve Invigilators</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="5" style="text-align:center;padding:20mm;color:#94a3b8">No reserve staff assigned.</td></tr>'}
      </tbody>
    </table>
  `;

  const title = weekLabel ? `ASSIGNED RESERVE STAFF - ${weekLabel.toUpperCase()}` : `ASSIGNED RESERVE STAFF`;
  return getReportLayout(title, table, '');
}

export function generateAssignedReservesExcel(freeStaffList: PeriodFreeStaff[], weekLabel?: string): Blob {
  const headers = ['Date', 'Period', 'Start Time', 'Reserve Exam Supervisors', 'Reserve Invigilators'];
  const sortedStaff = [...freeStaffList].sort((a, b) => {
    const dateCompare = a.exam_date.localeCompare(b.exam_date);
    if (dateCompare !== 0) return dateCompare;
    if (a.period !== b.period) return a.period - b.period;
    return a.role.localeCompare(b.role);
  });

  const periodGroups = new Map<string, PeriodFreeStaff[]>();
  sortedStaff.forEach(fs => {
    const key = `${fs.exam_date}_${fs.period}`;
    if (!periodGroups.has(key)) periodGroups.set(key, []);
    periodGroups.get(key)!.push(fs);
  });

  const rows: string[][] = [];
  periodGroups.forEach((staffList) => {
    const first = staffList[0];
    const assistants = staffList.filter(s => s.role === 'Assistant').map(s => s.staff?.name).join(', ') || 'None';
    const supervisors = staffList.filter(s => (s.role as string) === 'Exam_Supervisor' || (s.role as string) === 'Committees_Supervisor' || (s.role as string) === 'Head_Supervisor').map(s => `${s.staff?.name} (${getShortRole(s.role)})`).join(', ') || 'None';
    rows.push([
      first.exam_date,
      `Period ${first.period}`,
      first.start_time,
      supervisors,
      assistants
    ]);
  });

  const data = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  const sheetName = (weekLabel ? `Assigned Reserves ${weekLabel}` : "Assigned Reserves").substring(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
