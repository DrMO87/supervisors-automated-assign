const fs = require('fs');
let fileContent = fs.readFileSync('lib/utils/report-generators.ts', 'utf8');

// Replace all `<tr${classAttr}>` with `<tr${sep}>`
fileContent = fileContent.replace(/<tr\$\{classAttr\}>/g, '<tr${sep}>');

// In generateWeeklyHallHTML, replace `const classAttr = classes.length > 0` with `const sep = classes.length > 0`
fileContent = fileContent.replace(
  /const classAttr = classes\.length > 0 \? ` class="\$\{classes\.join\(' '\)\}"` : '';/g,
  'const sep = classes.length > 0 ? ` class="${classes.join(\' \')}"` : \'\';'
);

fs.writeFileSync('lib/utils/report-generators.ts', fileContent);
console.log('Fixed classAttr references!');
