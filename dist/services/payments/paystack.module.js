"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaystackModule = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const appError_1 = __importDefault(require("../../utils/appError"));
const logger_1 = __importDefault(require("../../utils/logger"));
class PaystackModule {
    constructor() {
        this.secretKey = process.env.PAYSTACK_SECRET_KEY || 'sk_test_placeholder';
        this.baseUrl = 'https://api.paystack.co';
    }
    getHeaders() {
        return {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
        };
    }
    /**
     * Initialize Paystack Transaction
     */
    async initializePayment(params) {
        const amountInKobo = Math.round(params.amount * 100);
        try {
            const payload = {
                email: params.email,
                amount: amountInKobo,
                reference: params.reference,
                metadata: params.metadata || {},
            };
            if (params.callbackUrl) {
                payload.callback_url = params.callbackUrl;
            }
            const response = await axios_1.default.post(`${this.baseUrl}/transaction/initialize`, payload, { headers: this.getHeaders() });
            const data = response.data.data;
            return {
                authorizationUrl: data.authorization_url,
                accessCode: data.access_code,
                reference: data.reference,
            };
        }
        catch (error) {
            logger_1.default.error('Paystack initializePayment error:', error.response?.data || error.message);
            throw new appError_1.default(error.response?.data?.message || 'Paystack payment initialization failed', error.response?.status || 500);
        }
    }
    /**
     * Verify Paystack Transaction by Reference
     */
    async verifyPayment(reference) {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, { headers: this.getHeaders() });
            return response.data.data;
        }
        catch (error) {
            logger_1.default.error(`Paystack verifyPayment error for ref ${reference}:`, error.response?.data || error.message);
            throw new appError_1.default(error.response?.data?.message || 'Paystack verification failed', error.response?.status || 500);
        }
    }
    /**
     * Cryptographically verify Paystack Webhook Signature (HMAC SHA-512)
     */
    verifyWebhookSignature(payload, signature) {
        if (!signature)
            return false;
        const hash = crypto_1.default
            .createHmac('sha512', this.secretKey)
            .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
            .digest('hex');
        return hash === signature;
    }
    /**
     * Create Transfer Recipient (for Riders / Restaurants payout)
     */
    async createTransferRecipient(params) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/transferrecipient`, {
                type: 'nuban',
                name: params.name,
                account_number: params.accountNumber,
                bank_code: params.bankCode,
                currency: 'NGN',
            }, { headers: this.getHeaders() });
            return {
                recipientCode: response.data.data.recipient_code,
            };
        }
        catch (error) {
            logger_1.default.error('Paystack createTransferRecipient error:', error.response?.data || error.message);
            throw new appError_1.default(error.response?.data?.message || 'Failed to create Paystack transfer recipient', error.response?.status || 500);
        }
    }
    /**
     * Initiate Payout / Bank Transfer (Riders / Restaurants)
     */
    async initiatePayout(params) {
        const amountInKobo = Math.round(params.amount * 100);
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/transfer`, {
                source: 'balance',
                reason: params.reason || 'Go-Eat Payout',
                amount: amountInKobo,
                recipient: params.recipientCode,
                reference: params.reference,
            }, { headers: this.getHeaders() });
            return response.data.data;
        }
        catch (error) {
            logger_1.default.error('Paystack initiatePayout error:', error.response?.data || error.message);
            throw new appError_1.default(error.response?.data?.message || 'Paystack payout initiation failed', error.response?.status || 500);
        }
    }
}
exports.PaystackModule = PaystackModule;
exports.default = new PaystackModule();
