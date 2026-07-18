import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

import emailService from '../src/services/email.service';

const recipient = process.argv[2] || 'echinecherem729@gmail.com';

async function main() {
  console.log(`Preparing to send test email to: ${recipient}`);

  try {
    // Send a templated OTP test email
    await emailService.sendOTP(recipient, '123456');
    console.log('✅ OTP Test Email dispatched successfully via EmailService!');

    // Send a general welcome template email
    await emailService.sendTemplateEmail(
      recipient,
      'WELCOME_PARTNER',
      'Go-Eat Partner Welcome Test',
      {
        partnerName: 'Test Partner Owner',
        restaurantName: 'Test Gourmet Restaurant',
        loginUrl: 'https://partner.goeat.com',
        email: 'partner@test.com',
        password: 'TestPassword123!'
      },
      'partners'
    );
    console.log('✅ Welcome Partner Test Email dispatched successfully via EmailService!');
  } catch (err: any) {
    console.error(`❌ Failed to send test emails: ${err.message}`);
    process.exit(1);
  }
}

main();
