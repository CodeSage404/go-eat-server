import twilio from 'twilio';
import logger from './logger';
import otpUtil from './otp.util';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

let client: twilio.Twilio | null = null;

if (accountSid && authToken && !accountSid.startsWith('your_') && !authToken.startsWith('your_')) {
  try {
    client = twilio(accountSid, authToken);
    logger.info('📱 Twilio client initialized for WhatsApp Verify service');
  } catch (error) {
    logger.error('❌ Failed to initialize Twilio client:', error);
  }
} else {
  logger.warn('⚠️ Twilio credentials use placeholders or are missing. Dynamic Redis OTP will handle phone verification.');
}

/**
 * Normalizes a phone number to E.164 standard (e.g. +2348012345678)
 */
export const formatPhoneNumber = (phoneNumber: string): string => {
  let formatted = phoneNumber.trim();
  if (formatted.startsWith('0')) {
    formatted = '+234' + formatted.substring(1);
  } else if (!formatted.startsWith('+')) {
    formatted = '+' + formatted;
  }
  return formatted;
};

/**
 * Initiates WhatsApp verification using Twilio Verify API.
 * Always generates a real dynamic 6-digit OTP stored in Redis.
 */
export const startWhatsAppVerification = async (to: string): Promise<string> => {
  const formattedTo = formatPhoneNumber(to);
  const otp = otpUtil.generateOTP();
  
  // Store real 6-digit OTP in Redis for the phone number
  await otpUtil.storeOTP(formattedTo, otp);
  await otpUtil.storeOTP(to, otp);

  if (client && serviceSid && !serviceSid.startsWith('your_')) {
    try {
      const verification = await client.verify.v2
        .services(serviceSid)
        .verifications.create({
          channel: 'sms',
          to: formattedTo,
        });

      logger.info(`📱 SMS verification initiated via Twilio. Sid: ${verification.sid} to ${formattedTo}`);
      return otp;
    } catch (error: any) {
      logger.warn(`⚠️ Twilio WhatsApp API dispatch error for ${formattedTo}: ${error.message}. Saved dynamic OTP in Redis.`);
      return otp;
    }
  } else {
    logger.info(`📱 Dynamic 6-digit WhatsApp OTP generated and stored in Redis for ${formattedTo}: ${otp}`);
    return otp;
  }
};

/**
 * Checks verification code using Twilio Verify API or Redis OTP store.
 * Never relies on hardcoded '123456' mock codes.
 */
export const checkWhatsAppVerification = async (to: string, code: string): Promise<boolean> => {
  const formattedTo = formatPhoneNumber(to);

  // 1. First check dynamic Redis OTP store
  const isRedisValid = (await otpUtil.verifyOTP(formattedTo, code)) || (await otpUtil.verifyOTP(to, code));
  if (isRedisValid) {
    logger.info(`✅ Phone number verification successful via Redis OTP for ${formattedTo}`);
    return true;
  }

  // 2. Check Twilio Verify API if client is configured
  if (client && serviceSid && !serviceSid.startsWith('your_')) {
    try {
      const check = await client.verify.v2
        .services(serviceSid)
        .verificationChecks.create({
          to: formattedTo,
          code,
        });

      const isApproved = check.status === 'approved';
      if (isApproved) {
        logger.info(`✅ SMS verification successful via Twilio for ${formattedTo}`);
        return true;
      } else {
        logger.warn(`⚠️ SMS verification failed via Twilio for ${formattedTo}. Status: ${check.status}`);
      }
    } catch (error: any) {
      logger.error(`❌ Error checking Twilio verification for ${formattedTo}:`, error.message || error);
    }
  }

  return false;
};
