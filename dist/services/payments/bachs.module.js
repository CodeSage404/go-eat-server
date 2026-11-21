"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BachsModule = void 0;
const axios_1 = __importDefault(require("axios"));
const appError_1 = __importDefault(require("../../utils/appError"));
const logger_1 = __importDefault(require("../../utils/logger"));
class BachsModule {
    /**
     * Resolve Bachs API Key strictly from DB Setting or Environment (.env)
     */
    async getApiKey() {
        try {
            const SettingModel = require('../../models/setting.model').default;
            const setting = await SettingModel.findOne();
            if (setting?.bachsApiKey && setting.bachsApiKey.trim() !== '') {
                return setting.bachsApiKey.trim();
            }
        }
        catch (e) {
            // fallback to environment variable
        }
        const key = (process.env.BACHS_API_KEY || '').trim();
        if (!key) {
            throw new appError_1.default('Bachs.io API key is not configured in environment variables (BACHS_API_KEY).', 500);
        }
        return key;
    }
    getBaseUrl() {
        return (process.env.BACHS_BASE_URL || 'https://api.bachs.io/v1').replace(/\/$/, '');
    }
    /**
     * Create hosted checkout session on Bachs.io
     */
    async initializePayment(params) {
        const apiKey = await this.getApiKey();
        const baseUrl = this.getBaseUrl();
        // Amount formatted to decimal string, minimum 2 decimal places e.g. "1500.00"
        const formattedAmount = Number(params.amount).toFixed(2);
        const payload = {
            pricing: {
                amount: formattedAmount,
                currency: 'NGN',
            },
            customer: {
                email: params.email,
                name: params.name || 'Go-Eat Customer',
            },
            metadata: {
                reference: params.reference,
                ...(params.metadata || {}),
            },
            success_url: params.callbackUrl ||
                `https://go-eat-server-z96s.onrender.com/api/v1/payments/verify?reference=${encodeURIComponent(params.reference)}&provider=bachs`,
            cancel_url: params.cancelUrl || 'https://goeatone.com/checkout',
        };
        try {
            logger_1.default.info(`[Bachs] Initializing checkout session for reference: ${params.reference}, amount: ${formattedAmount} NGN`);
            const res = await axios_1.default.post(`${baseUrl}/checkout-sessions`, payload, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                timeout: 20000,
            });
            const data = res.data;
            const checkoutUrl = data?.checkout_url || data?.data?.checkout_url || data?.url;
            const sessionId = data?.id || data?.data?.id || params.reference;
            if (!checkoutUrl) {
                logger_1.default.error(`[Bachs] No checkout_url returned from Bachs API: ${JSON.stringify(data)}`);
                throw new appError_1.default('Payment provider did not return a valid checkout redirect URL', 502);
            }
            return {
                authorizationUrl: checkoutUrl,
                reference: params.reference,
                sessionId,
            };
        }
        catch (error) {
            const errDetails = error.response?.data
                ? JSON.stringify(error.response.data)
                : error.message;
            logger_1.default.error(`[Bachs] Checkout session initialization failed: ${errDetails}`);
            throw new appError_1.default(`Bachs payment initialization error: ${error.response?.data?.message || error.message}`, error.response?.status || 500);
        }
    }
    /**
     * Verify checkout session on Bachs.io
     */
    async verifyPayment(referenceOrSessionId) {
        const apiKey = await this.getApiKey();
        const baseUrl = this.getBaseUrl();
        try {
            logger_1.default.info(`[Bachs] Verifying payment for: ${referenceOrSessionId}`);
            const res = await axios_1.default.get(`${baseUrl}/checkout-sessions/${encodeURIComponent(referenceOrSessionId)}`, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    Accept: 'application/json',
                },
                timeout: 15000,
            });
            const session = res.data?.data || res.data;
            const status = (session?.status || '').toLowerCase();
            const chargeStatus = (session?.charge?.status ||
                session?.payment_status ||
                session?.collection?.status ||
                '').toLowerCase();
            const isSuccessful = status === 'completed' ||
                status === 'succeeded' ||
                chargeStatus === 'succeeded' ||
                chargeStatus === 'paid';
            return {
                status: isSuccessful ? 'success' : status,
                session,
                id: session?.id,
                metadata: session?.metadata,
                amount: session?.pricing?.amount || session?.amount,
                currency: session?.pricing?.currency || 'NGN',
                customer: session?.customer,
            };
        }
        catch (error) {
            logger_1.default.error(`[Bachs] Verification failed: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
            throw new appError_1.default(`Bachs verification error: ${error.response?.data?.message || error.message}`, 400);
        }
    }
}
exports.BachsModule = BachsModule;
exports.default = new BachsModule();
