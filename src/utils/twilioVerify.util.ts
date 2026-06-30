import twilio from 'twilio';
import logger from './logger';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

let client: twilio.Twilio | null = null;

if (accountSid && authToken && !accountSid.startsWith('your_') && !authToken.startsWith('your_')) {
  try {
    client = twilio(accountSid, authToken);
    logger.info('📱 Twilio client initialized for Verify service');
  } catch (error) {
    logger.error('❌ Failed to initialize Twilio client:', error);
  }
} else {
  logger.warn('⚠️ Twilio credentials are not fully configured or use placeholders. Verify service running in MOCK mode.');
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
 * Initiates WhatsApp verification using Twilio Verify API
 */
export const startWhatsAppVerification = async (to: string): Promise<boolean> => {
  const formattedTo = formatPhoneNumber(to);

  if (!client || !serviceSid || serviceSid.startsWith('your_')) {
    logger.warn(`⚠️ [Twilio Verify MOCK] WhatsApp OTP sent to ${formattedTo}`);
    return true;
  }

  try {
    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications.create({
        channel: 'whatsapp',
        to: formattedTo,
      });

    logger.info(`📱 WhatsApp verification initiated. Sid: ${verification.sid} to ${formattedTo}`);
    return true;
  } catch (error: any) {
    logger.error(`❌ Error starting Twilio WhatsApp verification for ${formattedTo}:`, error.message || error);
    throw error;
  }
};

/**
 * Checks verification code using Twilio Verify API
 */
export const checkWhatsAppVerification = async (to: string, code: string): Promise<boolean> => {
  const formattedTo = formatPhoneNumber(to);

  if (!client || !serviceSid || serviceSid.startsWith('your_')) {
    logger.warn(`⚠️ [Twilio Verify MOCK] Checking code ${code} for ${formattedTo}`);
    // Fallback: accept '123456' for testing in mock mode
    return code === '123456';
  }

  try {
    const check = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({
        to: formattedTo,
        code,
      });

    const isApproved = check.status === 'approved';
    if (isApproved) {
      logger.info(`✅ WhatsApp verification successful for ${formattedTo}`);
    } else {
      logger.warn(`⚠️ WhatsApp verification failed for ${formattedTo}. Status: ${check.status}`);
    }
    return isApproved;
  } catch (error: any) {
    logger.error(`❌ Error checking Twilio verification for ${formattedTo}:`, error.message || error);
    return false;
  }
};
