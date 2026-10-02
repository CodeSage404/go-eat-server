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
const io_1 = require("../io");
const voiceServiceLastCallPushMap = new Map();
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
    get iosPushCredentialSid() {
        const isDev = process.env.NODE_ENV === 'development';
        if (isDev && process.env.TWILIO_IOS_SANDBOX_PUSH_CREDENTIAL_SID) {
            return process.env.TWILIO_IOS_SANDBOX_PUSH_CREDENTIAL_SID;
        }
        return process.env.TWILIO_IOS_PUSH_CREDENTIAL_SID || '';
    }
    get androidPushCredentialSid() {
        return process.env.TWILIO_ANDROID_PUSH_CREDENTIAL_SID || '';
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
     * Generate an in-app VoIP call token for an authenticated user and optional order
     */
    async generateVoiceToken(userId, orderId, role = 'customer', platform = 'ios', target = 'customer') {
        let order = null;
        if (orderId) {
            order = await order_model_1.default.findById(orderId)
                .populate('rider', 'name phoneNumber profilePicture profileImage vehicleType')
                .populate('customer', 'name phoneNumber profilePicture profileImage')
                .populate('restaurant', 'name phoneContact businessPhone phone phoneNumber logo owner');
            if (!order) {
                throw new appError_1.default('Order not found', 404);
            }
        }
        const { keySid, keySecret } = await this.getOrCreateApiKey();
        const identity = `${role}_${userId}`;
        let recipientIdentity = '';
        let recipientUserId = null;
        if (order) {
            if (role === 'vendor') {
                if (target === 'rider') {
                    recipientIdentity = `rider_${order.rider ? order.rider._id : 'unassigned'}`;
                    recipientUserId = order.rider ? order.rider._id?.toString() : null;
                }
                else {
                    recipientIdentity = `customer_${order.customer ? order.customer._id || order.customer : 'unknown'}`;
                    recipientUserId = order.customer ? (order.customer._id?.toString() || order.customer.toString()) : null;
                }
            }
            else if (role === 'customer') {
                if (target === 'restaurant') {
                    recipientIdentity = `vendor_${order.restaurant?.owner || order.restaurant}`;
                    recipientUserId = order.restaurant?.owner ? order.restaurant.owner.toString() : null;
                }
                else {
                    recipientIdentity = `rider_${order.rider ? order.rider._id : 'unassigned'}`;
                    recipientUserId = order.rider ? order.rider._id?.toString() : null;
                }
            }
            else {
                // rider calling
                if (target === 'restaurant') {
                    recipientIdentity = `vendor_${order.restaurant?.owner || order.restaurant}`;
                    recipientUserId = order.restaurant?.owner ? order.restaurant.owner.toString() : null;
                }
                else {
                    recipientIdentity = `customer_${order.customer ? order.customer._id || order.customer : 'unknown'}`;
                    recipientUserId = order.customer ? (order.customer._id?.toString() || order.customer.toString()) : null;
                }
            }
        }
        const AccessToken = twilio_1.default.jwt.AccessToken;
        const VoiceGrant = AccessToken.VoiceGrant;
        const pushCredentialSid = platform === 'android' ? this.androidPushCredentialSid : this.iosPushCredentialSid;
        const voiceGrant = new VoiceGrant({
            outgoingApplicationSid: this.twimlAppSid || undefined,
            incomingAllow: true,
            pushCredentialSid: pushCredentialSid || undefined,
        });
        const token = new AccessToken(this.accountSid, keySid, keySecret, {
            identity,
            ttl: orderId ? 3600 : 86400, // 24 hours for registration, 1 hour for active call
        });
        token.addGrant(voiceGrant);
        const riderData = order?.rider ? {
            name: order.rider.name || 'Delivery Courier',
            phoneNumber: order.rider.phoneNumber,
            profilePicture: order.rider.profilePicture || order.rider.profileImage,
            vehicleType: order.rider.vehicleType || 'Motorcycle',
        } : null;
        const customerData = order?.customer ? {
            name: order.customer.name || 'Customer',
            phoneNumber: order.customer.phoneNumber,
            profilePicture: order.customer.profilePicture || order.customer.profileImage,
        } : null;
        const restPhone = order?.restaurant?.phoneContact || order?.restaurant?.businessPhone || order?.restaurant?.phoneNumber || order?.restaurant?.phone;
        const restaurantData = order?.restaurant ? {
            name: order.restaurant.name || 'Restaurant Outlet',
            phoneContact: restPhone,
            businessPhone: restPhone,
            phoneNumber: restPhone,
            phone: restPhone,
            logo: order.restaurant.logo,
        } : null;
        return {
            token: token.toJwt(),
            identity,
            recipientIdentity,
            orderId: orderId || '',
            rider: riderData,
            customer: customerData,
            restaurant: restaurantData,
        };
    }
    /**
     * Notify recipient in real time when an active call is actually placed via TwiML
     */
    async notifyRecipientOnCallInitiated(to, callerName, orderId) {
        if (!to)
            return;
        const recipientIdentity = to.replace('client:', '');
        const parts = recipientIdentity.split('_');
        if (parts.length < 2)
            return;
        const recipientUserId = parts[1];
        if (!recipientUserId)
            return;
        const callCooldownKey = `${orderId || 'call'}_${recipientUserId}`;
        const now = Date.now();
        const lastSentTime = voiceServiceLastCallPushMap.get(callCooldownKey) || 0;
        if (now - lastSentTime < 25000) {
            return;
        }
        voiceServiceLastCallPushMap.set(callCooldownKey, now);
        const displayOrderId = orderId ? orderId.slice(-6).toUpperCase() : '';
        (0, io_1.emitToUser)(recipientUserId, 'incoming_call', {
            orderId: orderId || '',
            callerName: callerName || 'Go-Eat Partner',
            displayOrderId,
        });
    }
    /**
     * Generates TwiML for routing a call to a client identity or phone number
     */
    generateCallTwiml(to, callerName, orderId) {
        const VoiceResponse = twilio_1.default.twiml.VoiceResponse;
        const response = new VoiceResponse();
        if (to.startsWith('client:') || to.startsWith('rider_') || to.startsWith('customer_') || to.startsWith('vendor_')) {
            const clientName = to.replace('client:', '');
            const dial = response.dial({
                callerId: 'Go-Eat',
                answerOnBridge: true,
                timeout: 35,
            });
            const client = dial.client();
            client.identity(clientName);
            if (callerName) {
                client.parameter({ name: 'callerName', value: callerName });
            }
            if (orderId) {
                client.parameter({ name: 'orderId', value: orderId });
            }
        }
        else if (to.startsWith('+') || /^\d+$/.test(to)) {
            const dial = response.dial({ callerId: this.twilioPhoneNumber, timeout: 35 });
            dial.number((0, twilioVerify_util_1.formatPhoneNumber)(to));
        }
        else {
            const dial = response.dial({ callerId: 'Go-Eat', answerOnBridge: true, timeout: 35 });
            const client = dial.client();
            client.identity(to);
            if (callerName)
                client.parameter({ name: 'callerName', value: callerName });
            if (orderId)
                client.parameter({ name: 'orderId', value: orderId });
        }
        return response.toString();
    }
    /**
     * Initiates a masked cellular call bridge between parties
     */
    async initiateMaskedBridgeCall(orderId, callerUserId, target = 'customer') {
        const order = await order_model_1.default.findById(orderId)
            .populate('rider', 'phoneNumber name')
            .populate('customer', 'phoneNumber name')
            .populate('restaurant', 'phoneContact businessPhone phone phoneNumber name owner');
        if (!order) {
            throw new appError_1.default('Order not found', 404);
        }
        const callerUser = await user_model_1.default.findById(callerUserId);
        if (!callerUser) {
            throw new appError_1.default('Caller user not found', 404);
        }
        const restaurantPhone = order.restaurant?.phoneContact || order.restaurant?.businessPhone || order.restaurant?.phoneNumber || order.restaurant?.phone;
        let callerPhone = callerUser.phoneNumber;
        if (!callerPhone && callerUser.role === 'vendor' && restaurantPhone) {
            callerPhone = restaurantPhone;
        }
        if (!callerPhone) {
            throw new appError_1.default('Caller phone number not available for cellular call', 400);
        }
        let recipientPhone = '';
        let recipientLabel = 'your courier';
        if (callerUser.role === 'vendor') {
            if (target === 'rider' && order.rider?.phoneNumber) {
                recipientPhone = order.rider.phoneNumber;
                recipientLabel = 'your delivery courier';
            }
            else if (order.customer?.phoneNumber) {
                recipientPhone = order.customer.phoneNumber;
                recipientLabel = 'the customer';
            }
        }
        else if (callerUser.role === 'rider') {
            if (target === 'restaurant' && restaurantPhone) {
                recipientPhone = restaurantPhone;
                recipientLabel = 'the restaurant';
            }
            else if (order.customer?.phoneNumber) {
                recipientPhone = order.customer.phoneNumber;
                recipientLabel = 'the customer';
            }
        }
        else {
            // Customer calling courier or restaurant
            if (target === 'restaurant' && restaurantPhone) {
                recipientPhone = restaurantPhone;
                recipientLabel = 'the restaurant';
            }
            else if (order.rider?.phoneNumber) {
                recipientPhone = order.rider.phoneNumber;
                recipientLabel = 'your courier';
            }
        }
        if (!recipientPhone) {
            throw new appError_1.default('Recipient phone number not available for cellular call', 400);
        }
        const formattedCaller = (0, twilioVerify_util_1.formatPhoneNumber)(callerPhone);
        const formattedRecipient = (0, twilioVerify_util_1.formatPhoneNumber)(recipientPhone);
        const twilioFrom = this.twilioPhoneNumber;
        logger_1.default.info(`📞 Bridging masked call for Order ${orderId}: ${formattedCaller} -> Twilio -> ${formattedRecipient}`);
        try {
            const twiml = `
        <Response>
          <Say voice="Polly.Joanna">Connecting you securely to ${recipientLabel}. Please wait.</Say>
          <Dial callerId="${twilioFrom}" timeout="30">
            <Number>${formattedRecipient}</Number>
          </Dial>
        </Response>
      `.trim();
            const call = await this.client.calls.create({
                to: formattedCaller,
                from: twilioFrom,
                twiml,
            });
            logger_1.default.info(`✅ Masked bridge call initiated with SID: ${call.sid}`);
            return {
                callSid: call.sid,
                message: `Calling your phone now. When you answer, we will connect you to ${recipientLabel}.`,
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
