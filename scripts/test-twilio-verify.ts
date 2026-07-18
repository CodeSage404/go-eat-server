import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { startWhatsAppVerification } from '../src/utils/twilioVerify.util';

async function runTest() {
  const testNumber = '09168464955';
  console.log(`Sending Twilio Verify WhatsApp OTP to ${testNumber}...`);
  try {
    const success = await startWhatsAppVerification(testNumber);
    if (success) {
      console.log('✅ Twilio Verify verification initiated successfully!');
    } else {
      console.log('❌ Twilio Verify initiation failed.');
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

runTest();
