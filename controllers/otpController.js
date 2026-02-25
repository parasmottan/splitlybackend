import crypto from 'crypto';
import Otp from '../models/Otp.js';
import { sendEmail } from '../utils/mailer.js';

const emailTemplate = (otp) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 0; }
        .container { max-width: 440px; margin: 40px auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
        .header { padding: 40px 20px 20px; text-align: center; }
        .logo { width: 40px; height: 40px; background: #007AFF; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; }
        .logo-icon { width: 24px; height: 24px; background: white; border-radius: 4px; position: relative; }
        .logo-icon::after { content: ''; position: absolute; width: 12px; height: 12px; border: 2.5px solid #007AFF; border-radius: 2px; top: 3px; left: 3px; }
        .app-name { font-size: 22px; fontWeight: 700; color: #1a1a1a; margin-left: 8px; vertical-align: middle; }
        .content { padding: 0 40px 40px; text-align: center; }
        h1 { font-size: 28px; color: #1a1a1a; margin-bottom: 12px; font-weight: 800; }
        p { color: #666; font-size: 15px; line-height: 1.5; margin-bottom: 32px; }
        .otp-container { background: #EBF5FF; border: 1px solid #BDE0FF; border-radius: 16px; padding: 24px; margin-bottom: 32px; }
        .otp-code { font-size: 40px; font-weight: 700; color: #007AFF; letter-spacing: 12px; margin-right: -12px; }
        .footer { padding: 20px 40px 40px; border-top: 1px solid #f0f0f0; text-align: center; color: #999; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">
                <div class="logo-icon"></div>
            </div>
            <span class="app-name">Splitly</span>
        </div>
        <div class="content">
            <h1>Your verification code</h1>
            <p>Enter this code to verify your email address and start splitting expenses.</p>
            <div class="otp-container">
                <span class="otp-code">${otp}</span>
            </div>
            <p style="font-size: 13px; color: #999;">This code will expire in 5 minutes.</p>
        </div>
        <div class="footer">
            If you didn't request this, please ignore this email.<br>
            Splitly Inc. • San Francisco, CA
        </div>
    </div>
</body>
</html>
`;

export const generateAndSendOtp = async (email) => {
  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  console.log(`[OTP] Generating new OTP for ${email}...`);
  // Upsert OTP record using .save() to trigger pre-save hook (hashing)
  let otpRecord = await Otp.findOne({ email });
  if (otpRecord) {
    console.log(`[OTP] Updating existing record for ${email}`);
    otpRecord.otp = otp;
    otpRecord.expiresAt = expiresAt;
    otpRecord.attempts = 0;
    otpRecord.resendCount += 1;
    otpRecord.lastResendTime = new Date();
  } else {
    console.log(`[OTP] Creating new record for ${email}`);
    otpRecord = new Otp({ email, otp, expiresAt });
  }

  const saveStart = Date.now();
  await otpRecord.save();
  console.log(`[OTP] Record saved (hashed) in ${Date.now() - saveStart}ms`);

  console.log(`[OTP] Handing off to mailer for ${email}`);
  await sendEmail({
    to: email,
    subject: 'Verify your Splitly account',
    html: emailTemplate(otp),
  });
  console.log(`[OTP] Mailer finished for ${email}`);
};

export const verifyOtpCode = async (email, code) => {
  const otpRecord = await Otp.findOne({ email });

  if (!otpRecord) {
    throw new Error('OTP not found or expired');
  }

  if (otpRecord.attempts >= 5) {
    throw new Error('Too many verification attempts. Please resend code.');
  }

  const isMatch = await otpRecord.compareOtp(code);

  if (!isMatch) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    throw new Error('Invalid verification code');
  }

  // Success - delete OTP
  await Otp.deleteOne({ email });
  return true;
};
