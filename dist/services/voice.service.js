"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const twilio_1 = __importDefault(require("twilio"));
const logger_1 = __importDefault(require("../utils/logger"));
const appError_1 = __importDefault(require("../utils/appError"));
const order_model_1 = __importDefault(require("../models/order.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const twilioVerify_util_1 = require("../utils/twilioVerify.util");
class VoiceService {
    constructor() {
        this.cachedApiKeySid = null;
        this.cachedApiSecret = null;
    }
    get accountSid() {
        return process.env.TWILIO_ACCOUNT_SID || '';
    }
    get authToken() {
        return process.env.TWILIO_AUTH_TOKEN || '';
    }
    get twilioPhoneNumber() {
        return process.env.TWILIO_PHONE_NUMBER || '+19707037753';
    }
    get twimlAppSid() {
        return process.env.TWILIO_TWIML_APP_SID || '';
    }
    get client() {
        if (!this.accountSid || !this.authToken) {
            throw new appError_1.default('Twilio credentials are not configured on the server', 500);
        }
        return (0, twilio_1.default)(this.accountSid, this.authToken);
    }
    /**
     * Lazily resolves or generates an API Key and Secret for Voice SDK JWT generation.
     */
    async getOrCreateApiKey() {
        if (process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_SECRET) {
            return {
                keySid: process.env.TWILIO_API_KEY_SID,
                keySecret: process.env.TWILIO_API_SECRET,
            };
        }
        if (this.cachedApiKeySid && this.cachedApiSecret) {
            return {
                keySid: this.cachedApiKeySid,
                keySecret: this.cachedApiSecret,
            };
        }
        try {
            logger_1.default.info('Creating a new Twilio API Key for in-app voice calls...');
            const key = await this.client.newKeys.create({ friendlyName: 'Go-Eat Voice SDK Key' });
            this.cachedApiKeySid = key.sid;
            this.cachedApiSecret = key.secret;
            logger_1.default.info(`✅ Twilio API Key provisioned: ${key.sid}`);
            return { keySid: key.sid, keySecret: key.secret };
        }
        catch (error) {
            logger_1.default.error('Failed to create Twilio API Key:', error);
            throw new appError_1.default(`Failed to initialize Voice API Key: ${error.message}`, 500);
        }
    }
    /**
     * Generate an in-app VoIP call token for an authenticated user and order
     */
    async generateVoiceToken(userId, orderId, role = 'customer') {
        const order = await order_model_1.default.findById(orderId).populate('rider', 'name phoneNumber profilePicture vehicleType');
        if (!order) {
            throw new appError_1.default('Order not found', 404);
        }
        const { keySid, keySecret } = await this.getOrCreateApiKey();
        const identity = `${role}_${userId}`;
        const recipientIdentity = role === 'customer'
            ? `rider_${order.rider ? order.rider._id : 'unassigned'}`
            : `customer_${order.customer}`;
        const AccessToken = twilio_1.default.jwt.AccessToken;
        const VoiceGrant = AccessToken.VoiceGrant;
        const voiceGrant = new VoiceGrant({
            outgoingApplicationSid: this.twimlAppSid || undefined,
            incomingAllow: true,
        });
        const token = new AccessToken(this.accountSid, keySid, keySecret, {
            identity,
            ttl: 3600, // 1 hour
        });
        token.addGrant(voiceGrant);
        const riderData = order.rider ? {
            name: order.rider.name || 'Delivery Courier',
            phoneNumber: order.rider.phoneNumber,
            profilePicture: order.rider.profilePicture,
            vehicleType: order.rider.vehicleType || 'Motorcycle',
        } : null;
        return {
            token: token.toJwt(),
            identity,
            recipientIdentity,
            orderId,
            rider: riderData,
        };
    }
    /**
     * Generates TwiML for routing a call to a client identity or phone number
     */
    generateCallTwiml(to) {
        const VoiceResponse = twilio_1.default.twiml.VoiceResponse;
        const response = new VoiceResponse();
        if (to.startsWith('client:')) {
            const clientName = to.replace('client:', '');
            const dial = response.dial({ callerId: this.twilioPhoneNumber });
            dial.client(clientName);
        }
        else if (to.startsWith('+') || /^\d+$/.test(to)) {
            const dial = response.dial({ callerId: this.twilioPhoneNumber });
            dial.number((0, twilioVerify_util_1.formatPhoneNumber)(to));
        }
        else {
            const dial = response.dial({ callerId: this.twilioPhoneNumber });
            dial.client(to);
        }
        return response.toString();
    }
    /**
     * Initiates a masked cellular call bridge between customer and rider
     */
    async initiateMaskedBridgeCall(orderId, customerUserId) {
        const order = await order_model_1.default.findById(orderId).populate('rider', 'phoneNumber name');
        if (!order) {
            throw new appError_1.default('Order not found', 404);
        }
        const customer = await user_model_1.default.findById(customerUserId);
        if (!customer || !customer.phoneNumber) {
            throw new appError_1.default('Customer phone number not available for cellular call', 400);
        }
        const rider = order.rider;
        if (!rider || !rider.phoneNumber) {
            throw new appError_1.default('Courier has not been assigned or does not have a phone number', 400);
        }
        const customerPhone = (0, twilioVerify_util_1.formatPhoneNumber)(customer.phoneNumber);
        const riderPhone = (0, twilioVerify_util_1.formatPhoneNumber)(rider.phoneNumber);
        const twilioFrom = this.twilioPhoneNumber;
        logger_1.default.info(`📞 Bridging masked call for Order ${orderId}: ${customerPhone} -> Twilio -> ${riderPhone}`);
        try {
            const twiml = `
        <Response>
          <Say voice="Polly.Joanna">Connecting you securely to your Go Eat courier. Please wait.</Say>
          <Dial callerId="${twilioFrom}" timeout="30">
            <Number>${riderPhone}</Number>
          </Dial>
        </Response>
      `.trim();
            const call = await this.client.calls.create({
                to: customerPhone,
                from: twilioFrom,
                twiml,
            });
            logger_1.default.info(`✅ Masked bridge call initiated with SID: ${call.sid}`);
            return {
                callSid: call.sid,
                message: 'Calling your phone now. When you answer, we will connect you to your courier.',
                maskedCallerId: twilioFrom,
            };
        }
        catch (error) {
            logger_1.default.error('❌ Failed to initiate Twilio masked bridge call:', error);
            throw new appError_1.default(`Twilio call error: ${error.message || 'Unable to place call'}`, 500);
        }
    }
}
exports.default = new VoiceService();
