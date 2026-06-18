const XLSX = require('xlsx');

const filePath = 'C:\\Users\\dell\\Downloads\\weekly_schedule_report_2026-06-05 (4).xlsx';
const workbook = XLSX.readFile(filePath);

const sv = workbook.Sheets['Schedule View'];
if (sv) {
    const data = XLSX.utils.sheet_to_json(sv);
    const target = data.filter(r => r.Date === '2026-06-06' && r['Exam Type'] === 'oral');
    console.log(`\nFound ${target.length} oral exams for June 6 in Schedule View.`);
    if (target.length > 0) console.log(target.slice(0, 3));
}
