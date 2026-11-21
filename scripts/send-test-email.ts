import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

import emailService from '../src/services/email.service';

const recipient = process.argv[2] || 'echinecherem729@gmail.com';

async function main() {
  console.log(`Preparing to send test welcome email to: ${recipient}`);

  try {
    // Send a general welcome user template email
    await emailService.sendTemplateEmail(
      recipient,
      'WELCOME_USER',
      'Welcome to GoEatOne!',
      {
        name: 'Immanuel',
      },
      'default'
    );
    console.log(`✅ Welcome User Test Email dispatched successfully to ${recipient} via EmailService!`);
  } catch (err: any) {
    console.error(`❌ Failed to send test email: ${err.message}`);
    process.exit(1);
  }
}

main();
