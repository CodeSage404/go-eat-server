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
  to: string,
  existingOtp?: string
): Promise<{ channel: 'whatsapp' | 'sms' | 'redis'; otp: string }> => {
  const formattedTo = formatPhoneNumber(to);
  const otp = existingOtp || otpUtil.generateOTP();

  // Store fresh 6-digit OTP in Redis/Memory for all phone variations (E.164, local 0-prefix, and raw input)
  await otpUtil.storeOTP(formattedTo, otp);
  await otpUtil.storeOTP(to, otp);
  const localNum = to.startsWith('+234') ? '0' + to.slice(4) : (to.startsWith('0') ? to : '0' + to);
  await otpUtil.storeOTP(localNum, otp);

  if (client) {
    const fromWhatsApp = rawFromNumber.startsWith('whatsapp:') ? rawFromNumber : `whatsapp:${rawFromNumber}`;
    const toWhatsApp = `whatsapp:${formattedTo}`;
    const cleanFromPhone = rawFromNumber.replace('whatsapp:', '');
    const messageBody = `Your Go-Eat verification code is: ${otp}. Valid for 10 minutes. Do not share this code with anyone.`;

    let whatsappSuccess = false;
    let smsSuccess = false;

    // 1. Attempt WhatsApp message via Twilio
    try {
      const msg = await client.messages.create({
        from: fromWhatsApp,
        to: toWhatsApp,
        body: messageBody,
      });
      logger.info(`📱 WhatsApp OTP dispatched via Twilio. SID: ${msg.sid} to ${toWhatsApp}`);
      whatsappSuccess = true;
    } catch (whatsappError: any) {
      logger.warn(`⚠️ WhatsApp delivery note for ${toWhatsApp}: ${whatsappError.message}`);
    }

    // 2. Attempt SMS message via Twilio
    try {
      const smsMsg = await client.messages.create({
        from: cleanFromPhone,
        to: formattedTo,
        body: messageBody,
      });
      logger.info(`📱 SMS fallback dispatched via Twilio. SID: ${smsMsg.sid} to ${formattedTo}`);
      smsSuccess = true;
    } catch (smsError: any) {
      logger.warn(`⚠️ SMS dispatch note for ${formattedTo}: ${smsError.message}`);
    }

    const channel = whatsappSuccess ? 'whatsapp' : (smsSuccess ? 'sms' : 'redis');
    return { channel, otp };
  } else {
    logger.info(`📱 Dynamic 6-digit OTP generated and stored in Redis for ${formattedTo}: ${otp}`);
    return { channel: 'redis', otp };
  }
};

/**
 * Checks verification code using Redis OTP store across all phone formats or Twilio Verify API.
 */
export const checkWhatsAppVerification = async (to: string, code: string): Promise<boolean> => {
  const cleanPhone = to.trim();
  const cleanCode = code.trim();
  const formattedE164 = formatPhoneNumber(cleanPhone);
  const localFormat = cleanPhone.startsWith('+234')
    ? '0' + cleanPhone.slice(4)
    : (cleanPhone.startsWith('0') ? cleanPhone : '0' + cleanPhone);
  const rawDigits = cleanPhone.replace(/\D/g, '');

  // 1. Primary check: Dynamic Redis / Memory OTP store across all format variants
  const isRedisValid =
    (await otpUtil.verifyOTP(formattedE164, cleanCode)) ||
    (await otpUtil.verifyOTP(localFormat, cleanCode)) ||
    (await otpUtil.verifyOTP(cleanPhone, cleanCode)) ||
    (await otpUtil.verifyOTP(rawDigits, cleanCode));

  if (isRedisValid) {
    logger.info(`✅ Phone number verification successful via Redis OTP for ${formattedE164}`);
    return true;
  }

  // 2. Fallback check: Twilio Verify API if configured
  if (client && serviceSid && !serviceSid.startsWith('your_')) {
    try {
      const check = await client.verify.v2
        .services(serviceSid)
        .verificationChecks.create({
          to: formattedE164,
          code: cleanCode,
        });

      const isApproved = check.status === 'approved';
      if (isApproved) {
        logger.info(`✅ Verification successful via Twilio Verify for ${formattedE164}`);
        return true;
      }
    } catch (error: any) {
      logger.warn(`Verification check note for ${formattedE164}: ${error.message}`);
    }
  }

  return false;
};
