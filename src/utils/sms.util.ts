import axios from 'axios';
import logger from './logger';

/**
 * Sends a transactional SMS to a destination phone number.
 * Uses Termii (standard Nigerian SMS provider) if TERMII_API_KEY is configured.
 * Otherwise, falls back to logging the SMS to the console for frictionless local testing.
 * 
 * @param to Phone number in international format (e.g. +2348012345678 or 2348012345678)
 * @param message The text content of the SMS
 */
export const sendSMS = async (to: string, message: string): Promise<boolean> => {
  const apiKey = process.env.TERMII_API_KEY;
  const senderId = process.env.TERMII_SENDER_ID || 'GoEat';

  // Format phone number to international standard if it starts with 0
  let formattedTo = to.trim();
  if (formattedTo.startsWith('0')) {
    formattedTo = '234' + formattedTo.substring(1);
  } else if (formattedTo.startsWith('+')) {
    formattedTo = formattedTo.substring(1);
  }

  if (!apiKey) {
    logger.warn(`⚠️ [SMS MOCK] Termii API Key not configured. Message: "${message}" to ${formattedTo}`);
    return true;
  }

  try {
    const response = await axios.post('https://api.ng.termii.com/api/sms/send', {
      to: formattedTo,
      from: senderId,
      sms: message,
      type: 'plain',
      channel: 'generic',
      api_key: apiKey,
    });

    if (response.data && (response.data.code === 'ok' || response.data.message === 'Successfully Sent')) {
      logger.info(`📱 SMS sent successfully to ${formattedTo} via Termii`);
      return true;
    } else {
      logger.error('❌ Termii SMS sending failed:', response.data);
      return false;
    }
  } catch (error) {
    logger.error('❌ Error sending SMS via Termii:', error);
    return false;
  }
};
