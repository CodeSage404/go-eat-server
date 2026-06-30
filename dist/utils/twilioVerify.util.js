"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkWhatsAppVerification = exports.startWhatsAppVerification = exports.formatPhoneNumber = void 0;
const twilio_1 = __importDefault(require("twilio"));
const logger_1 = __importDefault(require("./logger"));
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
let client = null;
if (accountSid && authToken && !accountSid.startsWith('your_') && !authToken.startsWith('your_')) {
    try {
        client = (0, twilio_1.default)(accountSid, authToken);
        logger_1.default.info('📱 Twilio client initialized for Verify service');
    }
    catch (error) {
        logger_1.default.error('❌ Failed to initialize Twilio client:', error);
    }
}
else {
    logger_1.default.warn('⚠️ Twilio credentials are not fully configured or use placeholders. Verify service running in MOCK mode.');
}
/**
 * Normalizes a phone number to E.164 standard (e.g. +2348012345678)
 */
const formatPhoneNumber = (phoneNumber) => {
    let formatted = phoneNumber.trim();
    if (formatted.startsWith('0')) {
        formatted = '+234' + formatted.substring(1);
    }
    else if (!formatted.startsWith('+')) {
        formatted = '+' + formatted;
    }
    return formatted;
};
exports.formatPhoneNumber = formatPhoneNumber;
/**
 * Initiates WhatsApp verification using Twilio Verify API
 */
const startWhatsAppVerification = async (to) => {
    const formattedTo = (0, exports.formatPhoneNumber)(to);
    if (!client || !serviceSid || serviceSid.startsWith('your_')) {
        logger_1.default.warn(`⚠️ [Twilio Verify MOCK] WhatsApp OTP sent to ${formattedTo}`);
        return true;
    }
    try {
        const verification = await client.verify.v2
            .services(serviceSid)
            .verifications.create({
            channel: 'whatsapp',
            to: formattedTo,
        });
        logger_1.default.info(`📱 WhatsApp verification initiated. Sid: ${verification.sid} to ${formattedTo}`);
        return true;
    }
    catch (error) {
        logger_1.default.error(`❌ Error starting Twilio WhatsApp verification for ${formattedTo}:`, error.message || error);
        throw error;
    }
};
exports.startWhatsAppVerification = startWhatsAppVerification;
/**
 * Checks verification code using Twilio Verify API
 */
const checkWhatsAppVerification = async (to, code) => {
    const formattedTo = (0, exports.formatPhoneNumber)(to);
    if (!client || !serviceSid || serviceSid.startsWith('your_')) {
        logger_1.default.warn(`⚠️ [Twilio Verify MOCK] Checking code ${code} for ${formattedTo}`);
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
            logger_1.default.info(`✅ WhatsApp verification successful for ${formattedTo}`);
        }
        else {
            logger_1.default.warn(`⚠️ WhatsApp verification failed for ${formattedTo}. Status: ${check.status}`);
        }
        return isApproved;
    }
    catch (error) {
        logger_1.default.error(`❌ Error checking Twilio verification for ${formattedTo}:`, error.message || error);
        return false;
    }
};
exports.checkWhatsAppVerification = checkWhatsAppVerification;
