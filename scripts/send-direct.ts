import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

async function run() {
  const host = process.env.EMAIL_HOST || 'server390.web-hosting.com';
  const port = Number(process.env.EMAIL_PORT) || 465;
  const user = process.env.EMAIL_USER_DEFAULT || 'support@goeatone.com';
  const pass = process.env.EMAIL_PASS;

  console.log(`Using credentials: user=${user}, host=${host}, port=${port}`);

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
    debug: true,
    logger: true,
  });

  const mailOptions = {
    from: `"Go-Eat Support" <${user}>`,
    to: 'echinecherem729@gmail.com',
    subject: 'Direct SMTP Verification Test',
    text: 'Hello, this is a direct verification email sent from your newly configured cPanel mail server with SPF/DKIM active!',
    html: '<p>Hello, this is a direct verification email sent from your newly configured cPanel mail server with SPF/DKIM active!</p>',
  };

  try {
    console.log('Sending email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
  } catch (err: any) {
    console.error('Failed to send email:', err.message);
  }
}

run();
