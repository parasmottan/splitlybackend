import nodemailer from 'nodemailer';

const createTransporter = () => {
  const port = parseInt(process.env.SMTP_PORT, 10);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim(),
    port: port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER?.trim(),
      pass: process.env.SMTP_PASS?.trim(),
    },
    // Reliability settings
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 5000,    // 5 seconds
    socketTimeout: 15000,     // 15 seconds
  });
};

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  console.log('--- Mailer Initialization Debug ---');
  console.log('SMTP_HOST:', process.env.SMTP_HOST ? `[${process.env.SMTP_HOST.trim()}]` : 'UNDEFINED');
  console.log('SMTP_PORT:', process.env.SMTP_PORT ? `[${process.env.SMTP_PORT.trim()}]` : 'UNDEFINED');
  console.log('SMTP_USER:', process.env.SMTP_USER ? `[${process.env.SMTP_USER.trim()}]` : 'UNDEFINED');
  console.log('EMAIL_FROM:', process.env.EMAIL_FROM ? `[${process.env.EMAIL_FROM.trim()}]` : 'UNDEFINED');
  console.log('-----------------------------------');

  const port = parseInt(process.env.SMTP_PORT, 10);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim(),
    port: port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER?.trim(),
      pass: process.env.SMTP_PASS?.trim(),
    },
    // Reliability settings
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 5000,    // 5 seconds
    socketTimeout: 15000,     // 15 seconds
  });
  return transporter;
};

export const sendEmail = async ({ to, subject, html }) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Splitly <noreplysplitly@gmail.com>',
    to,
    subject,
    html,
  };

  const currentTransporter = getTransporter();
  console.log(`[Mailer] Attempting to send email to ${to}...`);
  try {
    const info = await currentTransporter.sendMail(mailOptions);
    console.log(`[Mailer] Email sent successfully: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`[Mailer] Error sending email: ${err.message}`);
    throw err;
  }
};

export default getTransporter;
