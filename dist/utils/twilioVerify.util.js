"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkWhatsAppVerification = exports.startWhatsAppVerification = exports.formatPhoneNumber = void 0;
const twilio_1 = __importDefault(require("twilio"));
const logger_1 = __importDefault(require("./logger"));
const otp_util_1 = __importDefault(require("./otp.util"));
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
let client = null;
if (accountSid && authToken && !accountSid.startsWith('your_') && !authToken.startsWith('your_')) {
    try {
        client = (0, twilio_1.default)(accountSid, authToken);
        logger_1.default.info('📱 Twilio client initialized for WhatsApp Verify service');
    }
    catch (error) {
        logger_1.default.error('❌ Failed to initialize Twilio client:', error);
    }
}
else {
    logger_1.default.warn('⚠️ Twilio credentials use placeholders or are missing. Dynamic Redis OTP will handle phone verification.');
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
 * Initiates WhatsApp verification using Twilio Verify API.
 * Always generates a real dynamic 6-digit OTP stored in Redis.
 */
const startWhatsAppVerification = async (to) => {
    const formattedTo = (0, exports.formatPhoneNumber)(to);
    const otp = otp_util_1.default.generateOTP();
    // Store real 6-digit OTP in Redis for the phone number
    await otp_util_1.default.storeOTP(formattedTo, otp);
    await otp_util_1.default.storeOTP(to, otp);
    if (client && serviceSid && !serviceSid.startsWith('your_')) {
        try {
            const verification = await client.verify.v2
                .services(serviceSid)
                .verifications.create({
                channel: 'whatsapp',
                to: formattedTo,
            });
            logger_1.default.info(`📱 WhatsApp verification initiated via Twilio. Sid: ${verification.sid} to ${formattedTo}`);
            return otp;
        }
        catch (error) {
            logger_1.default.warn(`⚠️ Twilio WhatsApp API dispatch error for ${formattedTo}: ${error.message}. Saved dynamic OTP in Redis.`);
            return otp;
        }
    }
    else {
        logger_1.default.info(`📱 Dynamic 6-digit WhatsApp OTP generated and stored in Redis for ${formattedTo}: ${otp}`);
        return otp;
    }
};
exports.startWhatsAppVerification = startWhatsAppVerification;
/**
 * Checks verification code using Twilio Verify API or Redis OTP store.
 * Never relies on hardcoded '123456' mock codes.
 */
const checkWhatsAppVerification = async (to, code) => {
    const formattedTo = (0, exports.formatPhoneNumber)(to);
    // 1. First check dynamic Redis OTP store
    const isRedisValid = (await otp_util_1.default.verifyOTP(formattedTo, code)) || (await otp_util_1.default.verifyOTP(to, code));
    if (isRedisValid) {
        logger_1.default.info(`✅ Phone number verification successful via Redis OTP for ${formattedTo}`);
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
                logger_1.default.info(`✅ WhatsApp verification successful via Twilio for ${formattedTo}`);
                return true;
            }
            else {
                logger_1.default.warn(`⚠️ WhatsApp verification failed via Twilio for ${formattedTo}. Status: ${check.status}`);
            }
        }
        catch (error) {
            logger_1.default.error(`❌ Error checking Twilio verification for ${formattedTo}:`, error.message || error);
        }
    }
    return false;
};
exports.checkWhatsAppVerification = checkWhatsAppVerification;
