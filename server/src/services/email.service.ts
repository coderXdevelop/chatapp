import nodemailer from 'nodemailer';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'ChatConnect <noreply@chatconnect.app>';
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

let smtpTransporter: nodemailer.Transporter | null = null;
if (GMAIL_USER && GMAIL_APP_PASSWORD) {
  smtpTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });
}

function parseFromAddress(fromStr: string): { name: string; email: string } {
  const match = fromStr.match(/^(?:"?([^<"]*)"?\s*)?<([^>]+)>$/);
  if (match && match[2]) {
    return { name: match[1]?.trim() || 'ChatConnect', email: match[2].trim() };
  }
  return { name: 'ChatConnect', email: fromStr.trim() };
}

export async function sendOTPEmail(email: string, otp: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const subject = 'Your ChatConnect Security Code';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; background-color: #0F172A; color: #F8FAFC; padding: 32px; border-radius: 12px; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #F59E0B; margin-top: 0;">ChatConnect Security Code</h2>
      <p style="color: #94A3B8; font-size: 16px;">Use the verification code below to complete your authentication:</p>
      <div style="background-color: #1E293B; border: 1px solid #334155; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #F59E0B; font-family: monospace;">${otp}</span>
      </div>
      <p style="color: #64748B; font-size: 14px;">This code expires in 5 minutes. If you did not request this code, please ignore this email.</p>
    </div>
  `;

  if (process.env.NODE_ENV === 'test') {
    // Rule 11: Never send real OTP emails during automated tests
    return;
  }

  try {
    if (BREVO_API_KEY) {
      try {
        const sender = parseFromAddress(EMAIL_FROM_ADDRESS);
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': BREVO_API_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender,
            to: [{ email: normalizedEmail }],
            subject,
            htmlContent,
          }),
        });

        if (response.ok) {
          console.log(`[Brevo] OTP email sent successfully to ${normalizedEmail}`);
          return;
        } else {
          const errorText = await response.text();
          console.error(`[Brevo] Failed to send OTP email (${response.status}):`, errorText);
        }
      } catch (e: any) {
        console.error(`[Brevo] Error sending OTP email to ${normalizedEmail}:`, e.message);
      }
    }

    if (smtpTransporter) {
      try {
        await smtpTransporter.sendMail({
          from: EMAIL_FROM_ADDRESS,
          to: normalizedEmail,
          subject,
          html: htmlContent,
        });
        console.log(`[SMTP] OTP email sent to ${normalizedEmail}`);
        return;
      } catch (e: any) {
        console.error(`[SMTP] Failed to send OTP email to ${normalizedEmail}:`, e.message);
      }
    }

    if (!BREVO_API_KEY && !smtpTransporter) {
      console.log(`[Email Service] No active email provider configured. OTP code '${otp}' was printed to terminal.`);
    }
  } catch (globalErr: any) {
    console.error(`[Email Service] Unexpected error attempting email delivery:`, globalErr.message);
  }
}
