import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import twilio from 'twilio';

async function updateFriendlyName() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    console.error('❌ Missing Twilio environment variables.');
    return;
  }

  console.log('Initiating Twilio client...');
  const client = twilio(accountSid, authToken);

  try {
    console.log(`Updating Friendly Name of Verify Service ${serviceSid} to "Go Eat"...`);
    const service = await client.verify.v2.services(serviceSid).update({
      friendlyName: 'Go Eat',
    });
    console.log('✅ SUCCESS!');
    console.log(`Verify Service SID: ${service.sid}`);
    console.log(`New Friendly Name: ${service.friendlyName}`);
  } catch (error: any) {
    console.error('❌ Failed to update Verify Service Friendly Name:', error.message || error);
  }
}

updateFriendlyName();
