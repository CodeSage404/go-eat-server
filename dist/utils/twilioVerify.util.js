"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkWhatsAppVerification = exports.startWhatsAppVerification = exports.formatPhoneNumber = void 0;
// server/src/utils/twilioVerify.util.ts - Direct WhatsApp with SMS Fallback Verification
const twilio_1 = __importDefault(require("twilio"));
const logger_1 = __importDefault(require("./logger"));
const otp_util_1 = __importDefault(require("./otp.util"));
const appError_1 = __importDefault(require("./appError"));
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const rawFromNumber = process.env.TWILIO_PHONE_NUMBER || '+15557765384';
const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
let client = null;
if (accountSid && authToken && !accountSid.startsWith('your_') && !authToken.startsWith('your_')) {
    try {
        client = (0, twilio_1.default)(accountSid, authToken);
        logger_1.default.info('📱 Twilio client initialized for WhatsApp & SMS messaging');
    }
    catch (error) {
        logger_1.default.error('❌ Failed to initialize Twilio client:', error);
    }
}
else {
    logger_1.default.warn('⚠️ Twilio credentials use placeholders or are missing. Dynamic Redis OTP will handle verification.');
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
 * Initiates phone verification:
 * 1. Dispatches WhatsApp OTP via Twilio Messages API using active WhatsApp sender
 * 2. Falls back to SMS if WhatsApp delivery encounters an issue
 * 3. Throws a clear error if both fail, advising the user to sign up via email
 */
const startWhatsAppVerification = async (to) => {
    const formattedTo = (0, exports.formatPhoneNumber)(to);
    const otp = otp_util_1.default.generateOTP();
    // Store fresh 6-digit OTP in Redis/Memory for both phone formats
    await otp_util_1.default.storeOTP(formattedTo, otp);
    await otp_util_1.default.storeOTP(to, otp);
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
            logger_1.default.info(`📱 WhatsApp OTP dispatched via Twilio. SID: ${msg.sid} to ${toWhatsApp}`);
            return { channel: 'whatsapp', otp };
        }
        catch (whatsappError) {
            logger_1.default.warn(`⚠️ WhatsApp delivery failed for ${toWhatsApp}: ${whatsappError.message}. Initiating SMS fallback...`);
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
                    logger_1.default.info(`📱 SMS fallback verification initiated via Twilio Verify. SID: ${smsVerification.sid} to ${formattedTo}`);
                }
                else {
                    const smsMsg = await client.messages.create({
                        from: rawFromNumber.replace('whatsapp:', ''),
                        to: formattedTo,
                        body: messageBody,
                    });
                    logger_1.default.info(`📱 SMS fallback dispatched via Twilio Messages. SID: ${smsMsg.sid} to ${formattedTo}`);
                }
                return { channel: 'sms', otp };
            }
            catch (smsError) {
                logger_1.default.error(`❌ Both WhatsApp and SMS verification failed for ${formattedTo}:`, smsError.message);
                throw new appError_1.default('Unable to deliver verification code via WhatsApp or SMS to this phone number. Please verify your phone number or sign up using your email address instead.', 400);
            }
        }
    }
    else {
        logger_1.default.info(`📱 Dynamic 6-digit OTP generated and stored in Redis for ${formattedTo}: ${otp}`);
        return { channel: 'redis', otp };
    }
};
exports.startWhatsAppVerification = startWhatsAppVerification;
/**
 * Checks verification code using Redis OTP store or Twilio Verify API.
 */
const checkWhatsAppVerification = async (to, code) => {
    const formattedTo = (0, exports.formatPhoneNumber)(to);
    const cleanCode = code.trim();
    // 1. Primary check: Dynamic Redis / Memory OTP store
    const isRedisValid = (await otp_util_1.default.verifyOTP(formattedTo, cleanCode)) || (await otp_util_1.default.verifyOTP(to, cleanCode));
    if (isRedisValid) {
        logger_1.default.info(`✅ Phone number verification successful via Redis OTP for ${formattedTo}`);
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
                logger_1.default.info(`✅ Verification successful via Twilio Verify for ${formattedTo}`);
                return true;
            }
        }
        catch (error) {
            logger_1.default.warn(`Verification check note for ${formattedTo}: ${error.message}`);
        }
    }
    return false;
};
exports.checkWhatsAppVerification = checkWhatsAppVerification;
