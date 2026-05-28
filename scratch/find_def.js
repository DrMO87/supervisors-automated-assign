const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'lib', 'utils', 'csv-helpers.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('function findExamSession') || line.includes('const findExamSession')) {
    console.log(`${index + 1}: ${line}`);
  }
});
