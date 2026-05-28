const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== 'scratch') {
        searchDir(filePath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('send-schedule') || content.includes('smtp') || content.includes('mail')) {
        console.log(`Found match in: ${filePath}`);
      }
    }
  });
}

searchDir(path.join(__dirname, '..'));
