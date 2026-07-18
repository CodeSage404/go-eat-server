import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import axios from 'axios';

async function runTest() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  const to = '+2349121059853';
  const body = 'Your Go-Eat OTP is 123456. Valid for 10 minutes.';

  console.log('--- Twilio SMS Raw Test ---');
  console.log('Account SID:', accountSid ? accountSid.substring(0, 10) + '...' : 'MISSING');
  console.log('Auth Token:', authToken ? '***set***' : 'MISSING');
  console.log('From:', from);
  console.log('To:', to);
  console.log('---------------------------');

  const params = new URLSearchParams();
  params.append('To', to);
  params.append('From', from!);
  params.append('Body', body);

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  try {
    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      params,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    console.log('✅ SUCCESS! Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('❌ TWILIO ERROR:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data?.message);
    console.error('Code:', error.response?.data?.code);
    console.error('More info:', error.response?.data?.more_info);
    console.error('Full response:', JSON.stringify(error.response?.data, null, 2));
  }
}

runTest();
