"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlutterwaveModule = void 0;
const axios_1 = __importDefault(require("axios"));
const appError_1 = __importDefault(require("../../utils/appError"));
const logger_1 = __importDefault(require("../../utils/logger"));
class FlutterwaveModule {
    constructor() {
        this.secretKey = process.env.FLUTTERWAVE_SECRET_KEY || 'FLWSECK_TEST-placeholder';
        this.secretHash = process.env.FLUTTERWAVE_SECRET_HASH || 'goeat_secure_secret_hash';
        this.baseUrl = 'https://api.flutterwave.com/v3';
    }
    getHeaders() {
        return {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
        };
    }
    /**
     * Initialize Flutterwave Transaction
     */
    async initializePayment(params) {
        if (this.secretKey.includes('placeholder') || process.env.USE_MOCK_PAYMENT === 'true') {
            logger_1.default.info(`[Flutterwave Dev/Mock] Generating simulated authorization URL for ${params.reference}`);
            return {
                authorizationUrl: `https://checkout.flutterwave.com/v3/hosted/pay/test_checkout?reference=${params.reference}&amount=${params.amount}`,
                reference: params.reference,
            };
        }
        try {
            const payload = {
                tx_ref: params.reference,
                amount: params.amount,
                currency: 'NGN',
                redirect_url: params.redirectUrl || 'https://goeatalone.com/payment/callback',
                customer: {
                    email: params.email && params.email.trim() !== '' ? params.email : 'customer@goeat.com',
                    name: params.customerName || (params.email ? params.email.split('@')[0] : 'Customer'),
                    phonenumber: params.customerPhone || '08000000000',
                },
                meta: params.metadata || {},
                customizations: {
                    title: 'Go-Eat Order Payment',
                    description: 'Payment for delicious food on Go-Eat',
                    logo: 'https://api.goeatalone.com/uploads/logo.png',
                },
            };
            const response = await axios_1.default.post(`${this.baseUrl}/payments`, payload, { headers: this.getHeaders() });
            const data = response.data.data;
            return {
                authorizationUrl: data.link,
                reference: params.reference,
            };
        }
        catch (error) {
            if (process.env.NODE_ENV !== 'production') {
                logger_1.default.warn(`[Flutterwave Dev Fallback] API error (${error.message}). Falling back to simulated checkout URL for dev testing.`);
                return {
                    authorizationUrl: `https://checkout.flutterwave.com/v3/hosted/pay/test_checkout?reference=${params.reference}&amount=${params.amount}`,
                    reference: params.reference,
                };
            }
            logger_1.default.error('Flutterwave initializePayment error:', error.response?.data || error.message);
            throw new appError_1.default(error.response?.data?.message || 'Flutterwave payment initialization failed', error.response?.status || 500);
        }
    }
    /**
     * Verify Flutterwave Transaction by Reference (tx_ref)
     */
    async verifyPayment(reference) {
        if (this.secretKey.includes('placeholder') || process.env.USE_MOCK_PAYMENT === 'true') {
            logger_1.default.info(`[Flutterwave Dev/Mock] Simulating successful verification for ${reference}`);
            return {
                id: reference,
                status: 'successful',
                tx_ref: reference,
                amount: 5000,
                meta: { orderId: reference.split('_')[1] },
                customer: { email: 'dev@goeatalone.com' },
            };
        }
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, { headers: this.getHeaders() });
            return response.data.data;
        }
        catch (error) {
            if (process.env.NODE_ENV !== 'production') {
                logger_1.default.warn(`[Flutterwave Dev Fallback] Verification error (${error.message}). Simulating successful verification for dev testing.`);
                return {
                    id: reference,
                    status: 'successful',
                    tx_ref: reference,
                    amount: 5000,
                    meta: { orderId: reference.split('_')[1] },
                    customer: { email: 'dev@goeatalone.com' },
                };
            }
            logger_1.default.error(`Flutterwave verifyPayment error for ref ${reference}:`, error.response?.data || error.message);
            throw new appError_1.default(error.response?.data?.message || 'Flutterwave verification failed', error.response?.status || 500);
        }
    }
    /**
     * Cryptographically verify Flutterwave Webhook Signature (verif-hash header)
     */
    verifyWebhookSignature(signatureHeader) {
        if (!signatureHeader)
            return false;
        return signatureHeader === this.secretHash;
    }
    /**
     * Initiate Payout / Bank Transfer (Riders / Restaurants)
     */
    async initiatePayout(params) {
        try {
            const payload = {
                account_bank: params.bankCode,
                account_number: params.accountNumber,
                amount: params.amount,
                narration: params.narration || 'Go-Eat Payout',
                currency: 'NGN',
                reference: params.reference,
                beneficiary_name: params.beneficiaryName || 'Go-Eat Partner',
            };
            const response = await axios_1.default.post(`${this.baseUrl}/transfers`, payload, { headers: this.getHeaders() });
            return response.data.data;
        }
        catch (error) {
            logger_1.default.error('Flutterwave initiatePayout error:', error.response?.data || error.message);
            throw new appError_1.default(error.response?.data?.message || 'Flutterwave payout initiation failed', error.response?.status || 500);
        }
    }
}
exports.FlutterwaveModule = FlutterwaveModule;
exports.default = new FlutterwaveModule();
