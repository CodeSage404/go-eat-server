// server/src/utils/twilioVerify.util.ts - Direct WhatsApp with SMS Fallback Verification
import twilio from 'twilio';
import logger from './logger';
import otpUtil from './otp.util';
import AppError from './appError';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const rawFromNumber = process.env.TWILIO_PHONE_NUMBER || '+15557765384';
const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

let client: twilio.Twilio | null = null;

if (accountSid && authToken && !accountSid.startsWith('your_') && !authToken.startsWith('your_')) {
  try {
    client = twilio(accountSid, authToken);
    logger.info('📱 Twilio client initialized for WhatsApp & SMS messaging');
  } catch (error) {
    logger.error('❌ Failed to initialize Twilio client:', error);
  }
} else {
  logger.warn('⚠️ Twilio credentials use placeholders or are missing. Dynamic Redis OTP will handle verification.');
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
 * Initiates phone verification:
 * 1. Dispatches WhatsApp OTP via Twilio Messages API using active WhatsApp sender
 * 2. Falls back to SMS if WhatsApp delivery encounters an issue
 * 3. Throws a clear error if both fail, advising the user to sign up via email
 */
export const startWhatsAppVerification = async (
  to: string
): Promise<{ channel: 'whatsapp' | 'sms' | 'redis'; otp: string }> => {
  const formattedTo = formatPhoneNumber(to);
  const otp = otpUtil.generateOTP();

  // Store fresh 6-digit OTP in Redis/Memory for both phone formats
  await otpUtil.storeOTP(formattedTo, otp);
  await otpUtil.storeOTP(to, otp);

  if (client) {
    const fromWhatsApp = rawFromNumber.startsWith('whatsapp:') ? rawFromNumber : `whatsapp:${rawFromNumber}`;
    const toWhatsApp = `whatsapp:${formattedTo}`;
    const messageBody = `Your Go-Eat verification code is: ${otp}. Valid for 10 minutes. Do not share this code with anyone.`;

    // 1. Primary Attempt: Direct WhatsApp Message
    try {
      const msg = await client.messages.create({
        from: fromWhatsApp,
        to: toWhatsApp,
        body: messageBody,
      });

      logger.info(`📱 WhatsApp OTP dispatched via Twilio. SID: ${msg.sid} to ${toWhatsApp}`);
      return { channel: 'whatsapp', otp };
    } catch (whatsappError: any) {
      logger.warn(`⚠️ WhatsApp delivery failed for ${toWhatsApp}: ${whatsappError.message}. Initiating SMS fallback...`);

      // 2. Secondary Attempt: Fallback to SMS
      try {
        // Try Twilio Messages SMS or Verify Service SMS
        if (serviceSid && !serviceSid.startsWith('your_')) {
          const smsVerification = await client.verify.v2
            .services(serviceSid)
            .verifications.create({
              channel: 'sms',
              to: formattedTo,
            });
          logger.info(`📱 SMS fallback verification initiated via Twilio Verify. SID: ${smsVerification.sid} to ${formattedTo}`);
        } else {
          const smsMsg = await client.messages.create({
            from: rawFromNumber.replace('whatsapp:', ''),
            to: formattedTo,
            body: messageBody,
          });
          logger.info(`📱 SMS fallback dispatched via Twilio Messages. SID: ${smsMsg.sid} to ${formattedTo}`);
        }

        return { channel: 'sms', otp };
      } catch (smsError: any) {
        logger.error(`❌ Both WhatsApp and SMS verification failed for ${formattedTo}:`, smsError.message);
        throw new AppError(
          'Unable to deliver verification code via WhatsApp or SMS to this phone number. Please verify your phone number or sign up using your email address instead.',
          400
        );
      }
    }
  } else {
    logger.info(`📱 Dynamic 6-digit OTP generated and stored in Redis for ${formattedTo}: ${otp}`);
    return { channel: 'redis', otp };
  }
};

/**
 * Checks verification code using Redis OTP store or Twilio Verify API.
 */
export const checkWhatsAppVerification = async (to: string, code: string): Promise<boolean> => {
  const formattedTo = formatPhoneNumber(to);
  const cleanCode = code.trim();

  // 1. Primary check: Dynamic Redis / Memory OTP store
  const isRedisValid = (await otpUtil.verifyOTP(formattedTo, cleanCode)) || (await otpUtil.verifyOTP(to, cleanCode));
  if (isRedisValid) {
    logger.info(`✅ Phone number verification successful via Redis OTP for ${formattedTo}`);
    return true;
  }

  // 2. Fallback check: Twilio Verify API if configured
  if (client && serviceSid && !serviceSid.startsWith('your_')) {
    try {
      const check = await client.verify.v2
        .services(serviceSid)
        .verificationChecks.create({
          to: formattedTo,
          code: cleanCode,
        });

      const isApproved = check.status === 'approved';
      if (isApproved) {
        logger.info(`✅ Verification successful via Twilio Verify for ${formattedTo}`);
        return true;
      }
    } catch (error: any) {
      logger.warn(`Verification check note for ${formattedTo}: ${error.message}`);
    }
  }

  return false;
};
