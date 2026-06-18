const XLSX = require('xlsx');

const filePath = 'C:\\Users\\dell\\Downloads\\weekly_schedule_report_2026-06-12.xlsx';
const workbook = XLSX.readFile(filePath);

console.log("Sheet Names:", workbook.SheetNames);
for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    console.log(`\nSheet: ${sheetName} (Rows: ${data.length})`);
    if (data.length > 0) {
        console.log("Sample:", data.slice(0, 1));
    }
}
