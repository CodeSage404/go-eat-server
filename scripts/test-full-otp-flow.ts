import path from 'path';
import dotenv from 'dotenv';

const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

import redisClient from '../src/config/redis';
import otpUtil from '../src/utils/otp.util';

async function main() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  const testEmail = 'echinecherem729@gmail.com';
  console.log(`🔍 Testing Real Dynamic 6-Digit OTP Generation for ${testEmail}...`);

  // 1. Generate real random OTP
  const otp = otpUtil.generateOTP();
  console.log(`🔑 Generated Real OTP: ${otp}`);

  // 2. Store in Redis
  await otpUtil.storeOTP(testEmail, otp);

  // 3. Verify OTP with correct code
  const isValidCorrect = await otpUtil.verifyOTP(testEmail, otp);
  console.log(`✅ Verification with correct code (${otp}):`, isValidCorrect ? 'SUCCESS' : 'FAILED');

  // 4. Verify OTP with wrong code / mock 123456
  const isValidWrong = await otpUtil.verifyOTP(testEmail, '123456');
  console.log(`❌ Verification with mock code ('123456'):`, isValidWrong ? 'ACCEPTED (FAIL)' : 'REJECTED (SUCCESS)');

  await redisClient.quit();
  console.log('\n✨ Dynamic OTP pipeline test complete!');
}

main();
