const fs = require('fs');
const lines = fs.readFileSync('lib/utils/report-generators.ts', 'utf8').split('\n');

function findLine(name) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`export function ${name}`)) {
      return i + 1;
    }
  }
  return -1;
}

const targets = [
  'generateWeeklyHallHTML',
  'generateWeeklyHallExcel',
  'generateStaffScheduleHTML',
  'generateStaffScheduleExcel',
  'generateAllStaffSchedulesHTML'
];

targets.forEach(t => {
  console.log(`${t}: Line ${findLine(t)}`);
});
