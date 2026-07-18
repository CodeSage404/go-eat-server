import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

const accounts = [
  'info@goeatone.com',
  'onboarding@goeatone.com',
  'partner@goeatone.com',
  'privacy@goeatone.com',
  'support@goeatone.com',
  'verify@goeatone.com',
  'business@goeatone.com',
  'dkalu@goeatone.com'
];

async function run() {
  const host = process.env.EMAIL_HOST || 'server390.web-hosting.com';
  const port = Number(process.env.EMAIL_PORT) || 465;
  const pass = process.env.EMAIL_PASS || 'Ukolism_16#';

  console.log(`Starting SMTP verification tests for all accounts on host: ${host}, port: ${port}...\n`);

  for (const user of accounts) {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false
      },
      timeout: 5000,
    } as any);

    try {
      await transporter.verify();
      console.log(`✅ SMTP verified successfully for: ${user}`);
    } catch (err: any) {
      console.error(`❌ SMTP verification failed for: ${user} -> Error: ${err.message}`);
    }
  }
}

run();
