const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

function sanitizeFileName(name) {
  return name.replace(/[\/\\:\*\?"<>\|]/g, '').replace(/\s+/g, '_');
}

async function testOutlookArabic() {
  const scratchDir = path.join(process.cwd(), 'scratch');
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

  const uniqueId = `${Date.now()}`;
  const staffName = "اية عادل";
  const cleanStaffName = sanitizeFileName(staffName);
  
  const jsonPath = path.join(scratchDir, `mail_${uniqueId}.json`);
  const pdfPath = path.join(scratchDir, `schedule_${cleanStaffName}_${uniqueId}.pdf`);

  const dummyPdf = Buffer.from("A".repeat(100)).toString('base64');
  fs.writeFileSync(pdfPath, Buffer.from(dummyPdf, 'base64'));

  const config = {
    toEmail: "test2@example.com",
    subject: `Test Schedule - ${staffName}`,
    htmlContent: `<h1>مرحبا ${staffName}</h1>`,
    pdfPath: pdfPath
  };
  fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2), 'utf8');

  const scriptPath = path.join(process.cwd(), 'lib', 'utils', 'send-outlook.ps1');

  console.log('Running powershell script with Arabic...');
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

testOutlookArabic();
