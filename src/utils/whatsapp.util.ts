import axios from 'axios';
import logger from './logger';

/**
 * Sends a transactional WhatsApp message to a destination phone number.
 * Uses Twilio if TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are configured.
 * Otherwise, falls back to logging the message to the console for frictionless local testing.
 * 
 * @param to Phone number in E.164 format (e.g. +2348012345678 or 08012345678)
 * @param message The text content of the WhatsApp message
 */
export const sendWhatsApp = async (to: string, message: string): Promise<boolean> => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  // Format phone number to E.164 standard (e.g. +2348012345678)
  let formattedTo = to.trim();
  if (formattedTo.startsWith('0')) {
    formattedTo = '+234' + formattedTo.substring(1);
  } else if (!formattedTo.startsWith('+')) {
    formattedTo = '+' + formattedTo;
  }

  // Prepend the WhatsApp protocol specifier
  const whatsappTo = `whatsapp:${formattedTo}`;
  const whatsappFrom = `whatsapp:${from}`;

  if (!accountSid || !authToken || !from) {
    logger.warn(`⚠️ [WhatsApp MOCK] Twilio not fully configured. Message: "${message}" to ${whatsappTo}`);
    return true;
  }

  try {
    const params = new URLSearchParams();
    params.append('To', whatsappTo);
    params.append('From', whatsappFrom);
    params.append('Body', message);

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

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

    if (response.status === 201) {
      logger.info(`📱 WhatsApp message sent successfully to ${whatsappTo} via Twilio`);
      return true;
    } else {
      logger.error('❌ Twilio WhatsApp sending failed:', response.data);
      return false;
    }
  } catch (error: any) {
    logger.error('❌ Error sending WhatsApp via Twilio:', error.response?.data || error.message);
    return false;
  }
};
