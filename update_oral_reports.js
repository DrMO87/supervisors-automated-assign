const fs = require('fs');

let fileContent = fs.readFileSync('lib/utils/report-generators.ts', 'utf8');

// 1. Add CSS for oral exams
const cssReplacement = `
    tr.day-separator > td {
      border-top: 3px solid #1e293b !important;
    }
    tr.period-separator > td {
      border-top: 2px dashed #94a3b8 !important;
    }
    tr.oral-exam-row > td {
      background-color: #fefce8 !important;
    }
`;

fileContent = fileContent.replace(
  /tr\.day-separator > td \{\s*border-top: 3px solid #1e293b !important;\s*\}\s*tr\.period-separator > td \{\s*border-top: 2px dashed #94a3b8 !important;\s*\}/,
  cssReplacement.trim()
);

// 2. Update sorting logic for HTML
const oldSort = `const pA = getPeriodFromTime(a.start_time);
    const pB = getPeriodFromTime(b.start_time);
    if (pA !== pB) return pA - pB;
    return (a.room?.room_name || '').localeCompare(b.room?.room_name || '');`;

const newSort = `const pA = getPeriodFromTime(a.start_time);
    const pB = getPeriodFromTime(b.start_time);
    if (pA !== pB) return pA - pB;
    const isOralA = a.exam_type === 'Oral' ? 1 : 0;
    const isOralB = b.exam_type === 'Oral' ? 1 : 0;
    if (isOralA !== isOralB) return isOralA - isOralB;
    return (a.room?.room_name || '').localeCompare(b.room?.room_name || '');`;

// Wait, the formatting might differ slightly. I will use regex replace on the entire file for the sort logic.
fileContent = fileContent.replace(
  /const pA = getPeriodFromTime\(a\.start_time\);\s*const pB = getPeriodFromTime\(b\.start_time\);\s*if \(pA !== pB\) return pA - pB;\s*return \(a\.room\?\.room_name \|\| ''\)\.localeCompare\(b\.room\?\.room_name \|\| ''\);/g,
  newSort
);

// 3. Update row formatting in HTML to add oral-exam-row
const oldRowLogic = `    const rows = sortedExams.map((exam, i, arr) => {
    let sep = '';
    if (i > 0) {
      const prev = arr[i-1];
      if (prev.exam_date !== exam.exam_date) sep = ' class="day-separator"';
      else if (getPeriodFromTime(prev.start_time) !== getPeriodFromTime(exam.start_time)) sep = ' class="period-separator"';
    }`;

const newRowLogic = `    const rows = sortedExams.map((exam, i, arr) => {
    let classes = [];
    if (i > 0) {
      const prev = arr[i-1];
      if (prev.exam_date !== exam.exam_date) classes.push('day-separator');
      else if (getPeriodFromTime(prev.start_time) !== getPeriodFromTime(exam.start_time)) classes.push('period-separator');
    }
    if (exam.exam_type === 'Oral') classes.push('oral-exam-row');
    const classAttr = classes.length > 0 ? \` class="\${classes.join(' ')}"\` : '';`;

fileContent = fileContent.replace(
  /const rows = sortedExams\.map\(\(exam, i, arr\) => \{\s*let sep = '';\s*if \(i > 0\) \{\s*const prev = arr\[i-1\];\s*if \(prev\.exam_date !== exam\.exam_date\) sep = ' class="day-separator"';\s*else if \(getPeriodFromTime\(prev\.start_time\) !== getPeriodFromTime\(exam\.start_time\)\) sep = ' class="period-separator"';\s*\}/g,
  newRowLogic
);

// 4. Update the <tr${sep}> to <tr${classAttr}> in generateWeeklyHallHTML
// Look exactly for return `<tr${sep}>  where it appears after freeStaffCell
fileContent = fileContent.replace(
  /return `<tr\$\{sep\}>/g,
  "return `<tr${classAttr}>" // This might erroneously hit generateDailyHallHTML or generateRoomScheduleHTML but wait, I updated ALL sep logic!
);

// Ah, wait! The regex for oldRowLogic replaced it in multiple places!
// Did it? Yes, generateDailyHallHTML and generateRoomScheduleHTML also have similar loops, but they might not exactly match the oldRowLogic.
// Let's check how many times oldRowLogic was replaced.

fs.writeFileSync('lib/utils/report-generators.ts', fileContent);
console.log('Update script executed successfully');
