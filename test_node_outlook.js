const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testOutlook() {
  const scratchDir = path.join(process.cwd(), 'scratch');
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

  const uniqueId = `${Date.now()}`;
  const jsonPath = path.join(scratchDir, `mail_${uniqueId}.json`);
  const pdfPath = path.join(scratchDir, `schedule_test_${uniqueId}.pdf`);

  // Create a 1MB dummy base64 string to simulate the logos
  const hugeHtml = "<html><body><h1>Test</h1><img src='data:image/png;base64," + "A".repeat(1024 * 1024) + "' /></body></html>";
  const dummyPdf = Buffer.from("A".repeat(1024 * 1024)).toString('base64');

  fs.writeFileSync(pdfPath, Buffer.from(dummyPdf, 'base64'));

  const config = {
    toEmail: "test@example.com",
    subject: "Large Payload Test",
    htmlContent: hugeHtml,
    pdfPath: pdfPath
  };
  fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2), 'utf8');

  const scriptPath = path.join(process.cwd(), 'lib', 'utils', 'send-outlook.ps1');

  console.log('Running powershell script...');
  const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -JsonPath "${jsonPath}"`;
  
  exec(cmd, (error, stdout, stderr) => {
    console.log('STDOUT:', stdout);
    console.log('STDERR:', stderr);
    if (error) {
      console.log('ERROR:', error.message);
    } else {
      console.log('SUCCESS');
    }
  });
}

testOutlook();
