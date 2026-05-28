import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Sanitizes staff name to create a safe file name across platforms (especially Windows).
 */
const sanitizeFileName = (name: string): string => {
  return name.replace(/[\/\\:\*\?"<>\|]/g, '').replace(/\s+/g, '_');
};

/**
 * Automates the local Windows Outlook Desktop App via a helper PowerShell COM script.
 */
async function sendViaOutlook(
  toEmail: string,
  subject: string,
  htmlContent: string,
  pdfBase64?: string,
  staffName?: string
): Promise<void> {
  const scratchDir = path.join(process.cwd(), 'scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }

  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const jsonPath = path.join(scratchDir, `mail_${uniqueId}.json`);
  const cleanStaffName = sanitizeFileName(staffName || 'staff');
  const pdfPath = pdfBase64 ? path.join(scratchDir, `schedule_${cleanStaffName}_${uniqueId}.pdf`) : '';

  try {
    // Write PDF file if present
    if (pdfBase64) {
      fs.writeFileSync(pdfPath, Buffer.from(pdfBase64, 'base64'));
    }

    // Write parameters to a temporary JSON file to avoid shell command escaping limits
    const config = {
      toEmail,
      subject,
      htmlContent,
      pdfPath
    };
    fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2), 'utf8');

    const scriptPath = path.join(process.cwd(), 'lib', 'utils', 'send-outlook.ps1');

    await new Promise<void>((resolve, reject) => {
      // Execute the PowerShell automation helper
      const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -JsonPath "${jsonPath}"`;
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error('Outlook automation execution error:', error);
          reject(new Error(stderr.trim() || error.message || 'PowerShell script execution failed'));
        } else if (stdout.includes('SUCCESS')) {
          resolve();
        } else {
          reject(new Error(stdout.trim() || 'PowerShell script completed without SUCCESS indicator'));
        }
      });
    });
  } finally {
    // Ensure all temporary files are cleaned up immediately
    if (fs.existsSync(jsonPath)) {
      try { fs.unlinkSync(jsonPath); } catch {}
    }
    if (pdfPath && fs.existsSync(pdfPath)) {
      try { fs.unlinkSync(pdfPath); } catch {}
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { toEmail, subject, htmlContent, pdfBase64, staffName } = await request.json();

    if (!toEmail) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
    }

    // SMTP Credentials from environment variables
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFromName = process.env.SMTP_FROM_NAME || 'Horus University Exam System';

    // Auto-select outlook driver if on Windows and SMTP is not configured
    let emailDriver = process.env.EMAIL_DRIVER || 'smtp';
    if (!process.env.EMAIL_DRIVER && process.platform === 'win32' && (!smtpUser || !smtpPass)) {
      emailDriver = 'outlook';
    }

    console.log(`[ESMS Mailer] Routing email to driver [${emailDriver}] for recipient [${toEmail}]`);

    if (emailDriver === 'outlook') {
      if (process.platform !== 'win32') {
        throw new Error('Outlook COM automation driver is only supported on Windows server environments.');
      }
      await sendViaOutlook(toEmail, subject, htmlContent, pdfBase64, staffName);
    } else {
      // SMTP Driver using Nodemailer
      if (!smtpUser || !smtpPass) {
        return NextResponse.json({ 
          error: 'SMTP credentials are not configured on the server. Please set SMTP_USER and SMTP_PASS in your environment or .env.local file.' 
        }, { status: 500 });
      }

      const secure = smtpPort === 465;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: secure,
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      await transporter.sendMail({
        from: `"${smtpFromName}" <${smtpUser}>`,
        to: toEmail,
        subject: subject || `Exam Supervision Schedule - ${staffName || ''}`,
        html: htmlContent,
        attachments: pdfBase64 ? [
          {
            filename: `schedule_${sanitizeFileName(staffName || 'staff')}.pdf`,
            content: Buffer.from(pdfBase64, 'base64'),
            contentType: 'application/pdf'
          }
        ] : undefined
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Email API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
  }
}
