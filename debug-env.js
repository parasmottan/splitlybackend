import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

console.log('Current working directory:', process.cwd());
const envPath = path.resolve(process.cwd(), '.env');
console.log('Checking .env at:', envPath);

if (fs.existsSync(envPath)) {
  console.log('.env file exists');
  const content = fs.readFileSync(envPath, 'utf8');
  console.log('.env content length:', content.length);
  // Log first few lines (hidden secrets)
  console.log('.env first line starts with:', content.split('\n')[0].substring(0, 4));
} else {
  console.log('.env file NOT found');
}

dotenv.config();

console.log('Loaded SMTP_HOST:', process.env.SMTP_HOST ? `[${process.env.SMTP_HOST}]` : 'UNDEFINED');
console.log('Loaded SMTP_PORT:', process.env.SMTP_PORT ? `[${process.env.SMTP_PORT}]` : 'UNDEFINED');
console.log('Loaded EMAIL_FROM:', process.env.EMAIL_FROM ? `[${process.env.EMAIL_FROM}]` : 'UNDEFINED');
if (process.env.SMTP_PASS) {
  console.log('SMTP_PASS length:', process.env.SMTP_PASS.length);
  console.log('SMTP_PASS space count:', (process.env.SMTP_PASS.match(/ /g) || []).length);
}
