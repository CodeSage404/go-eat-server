"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSMS = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("./logger"));
/**
 * Sends a transactional SMS to a destination phone number.
 * Uses Twilio if TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are configured.
 * Otherwise, falls back to logging the SMS to the console for frictionless local testing.
 *
 * @param to Phone number in E.164 format (e.g. +2348012345678 or 08012345678)
 * @param message The text content of the SMS
 */
const sendSMS = async (to, message) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    // Format phone number to E.164 standard (e.g. +2348012345678)
    let formattedTo = to.trim();
    if (formattedTo.startsWith('0')) {
        formattedTo = '+234' + formattedTo.substring(1);
    }
    else if (!formattedTo.startsWith('+')) {
        formattedTo = '+' + formattedTo;
    }
    if (!accountSid || !authToken || !from) {
        logger_1.default.warn(`⚠️ [SMS MOCK] Twilio not fully configured. Message: "${message}" to ${formattedTo}`);
        return true;
    }
    try {
        const params = new URLSearchParams();
        params.append('To', formattedTo);
        params.append('From', from);
        params.append('Body', message);
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const response = await axios_1.default.post(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, params, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        if (response.status === 201) {
            logger_1.default.info(`📱 SMS sent successfully to ${formattedTo} via Twilio`);
            return true;
        }
        else {
            logger_1.default.error('❌ Twilio SMS sending failed:', response.data);
            return false;
        }
    }
    catch (error) {
        logger_1.default.error('❌ Error sending SMS via Twilio:', error.response?.data || error.message);
        return false;
    }
};
exports.sendSMS = sendSMS;
