"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = __importDefault(require("../../utils/logger"));
const appError_1 = __importDefault(require("../../utils/appError"));
class StripeModule {
    constructor() {
        this.baseUrl = 'https://api.stripe.com/v1';
    }
    get secretKey() {
        return process.env.STRIPE_SECRET_KEY || '';
    }
    getHeaders() {
        return {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        };
    }
    /**
     * Initialize Stripe Checkout Session
     */
    async initializePayment(params) {
        const amountInCents = Math.round(params.amount * 100);
        const email = params.email && params.email.trim() !== '' ? params.email : 'support@goeatone.com';
        const currency = (params.currency || 'gbp').toLowerCase();
        if (!this.secretKey) {
            throw new appError_1.default('Stripe payment gateway is not properly configured. Missing STRIPE_SECRET_KEY in environment.', 500);
        }
        try {
            const formData = new URLSearchParams();
            formData.append('payment_method_types[]', 'card');
            formData.append('line_items[0][price_data][currency]', currency);
            formData.append('line_items[0][price_data][product_data][name]', 'Go-Eat Order');
            formData.append('line_items[0][price_data][unit_amount]', amountInCents.toString());
            formData.append('line_items[0][quantity]', '1');
            formData.append('mode', 'payment');
            const redirectBase = params.redirectUrl || `https://api.goeatalone.com/payment/callback?reference=${params.reference}&provider=stripe`;
            const separator = redirectBase.includes('?') ? '&' : '?';
            formData.append('success_url', `${redirectBase}${separator}session_id={CHECKOUT_SESSION_ID}&status=success`);
            formData.append('cancel_url', `${redirectBase}${separator}status=cancelled`);
            formData.append('client_reference_id', params.reference);
            formData.append('customer_email', email);
            if (params.metadata) {
                for (const [key, val] of Object.entries(params.metadata)) {
                    if (val !== undefined && val !== null) {
                        formData.append(`metadata[${key}]`, String(val));
                    }
                }
            }
            const response = await axios_1.default.post(`${this.baseUrl}/checkout/sessions`, formData.toString(), {
                headers: this.getHeaders(),
            });
            return {
                authorizationUrl: response.data.url,
                reference: params.reference,
                sessionId: response.data.id,
            };
        }
        catch (error) {
            const errorMessage = error.response?.data?.error?.message || error.message || 'Stripe error';
            logger_1.default.error(`Stripe initializePayment error: ${errorMessage}`);
            throw new appError_1.default(errorMessage, error.response?.status || 500);
        }
    }
    /**
     * Verify Payment Status from Stripe
     */
    async verifyPayment(reference) {
        if (!this.secretKey) {
            throw new appError_1.default('Stripe payment gateway is not properly configured. Missing STRIPE_SECRET_KEY in environment.', 500);
        }
        try {
            let session = null;
            // 1. If reference is a Stripe checkout session id (cs_...)
            if (reference.startsWith('cs_')) {
                const response = await axios_1.default.get(`${this.baseUrl}/checkout/sessions/${reference}`, {
                    headers: this.getHeaders(),
                });
                session = response.data;
            }
            else {
                // 2. Query recent sessions and match by client_reference_id
                const response = await axios_1.default.get(`${this.baseUrl}/checkout/sessions?limit=50`, {
                    headers: this.getHeaders(),
                });
                const sessions = response.data?.data || [];
                session = sessions.find((s) => s.client_reference_id === reference);
            }
            if (!session) {
                throw new appError_1.default('Transaction not found on Stripe', 404);
            }
            if (session.payment_status !== 'paid') {
                throw new appError_1.default(`Stripe payment was not successful (status: ${session.payment_status})`, 400);
            }
            return {
                id: session.id,
                status: 'success',
                metadata: {
                    orderId: session.metadata?.orderId || (session.client_reference_id ? session.client_reference_id.split('_')[1] : undefined),
                    orderIds: session.metadata?.orderIds,
                    customerId: session.metadata?.customerId,
                },
            };
        }
        catch (error) {
            const errorMessage = error.response?.data?.error?.message || error.message || 'Stripe error';
            logger_1.default.error(`Stripe verifyPayment error: ${errorMessage}`);
            throw new appError_1.default(errorMessage, error.response?.status || 500);
        }
    }
    /**
     * Process refund via Stripe
     */
    async refundPayment(params) {
        if (!this.secretKey) {
            throw new appError_1.default('Stripe payment gateway is not properly configured.', 500);
        }
        try {
            let paymentIntentId = params.paymentIntentId;
            if (!paymentIntentId && params.sessionId) {
                const sessionRes = await axios_1.default.get(`${this.baseUrl}/checkout/sessions/${params.sessionId}`, {
                    headers: this.getHeaders(),
                });
                paymentIntentId = sessionRes.data?.payment_intent;
            }
            if (!paymentIntentId) {
                throw new appError_1.default('Could not identify Stripe payment intent for refund', 400);
            }
            const formData = new URLSearchParams();
            formData.append('payment_intent', paymentIntentId);
            if (params.amountInCents && params.amountInCents > 0) {
                formData.append('amount', Math.round(params.amountInCents).toString());
            }
            if (params.reason) {
                formData.append('metadata[reason]', params.reason);
            }
            const response = await axios_1.default.post(`${this.baseUrl}/refunds`, formData.toString(), {
                headers: this.getHeaders(),
            });
            logger_1.default.info(`✅ Stripe refund successful: ${response.data?.id} for payment_intent ${paymentIntentId}`);
            return response.data;
        }
        catch (error) {
            const errorMessage = error.response?.data?.error?.message || error.message || 'Stripe refund error';
            logger_1.default.error(`Stripe refundPayment error: ${errorMessage}`);
            throw new appError_1.default(errorMessage, error.response?.status || 500);
        }
    }
    /**
     * Cryptographically verify Stripe Webhook Signature (HMAC SHA-256)
     */
    verifyWebhookSignature(rawBody, signatureHeader) {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret || !signatureHeader)
            return false;
        try {
            const items = signatureHeader.split(',');
            let timestamp = '';
            const signatures = [];
            for (const item of items) {
                const parts = item.trim().split('=');
                if (parts[0] === 't') {
                    timestamp = parts[1];
                }
                else if (parts[0] === 'v1') {
                    signatures.push(parts[1]);
                }
            }
            if (!timestamp || signatures.length === 0) {
                return false;
            }
            // 5-minute replay attack tolerance
            const now = Math.floor(Date.now() / 1000);
            const eventTime = parseInt(timestamp, 10);
            if (isNaN(eventTime) || Math.abs(now - eventTime) > 300) {
                logger_1.default.warn('Stripe webhook signature timestamp outside 5-minute tolerance window');
                return false;
            }
            const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
            const signedPayload = `${timestamp}.${bodyStr}`;
            const computedHash = crypto_1.default
                .createHmac('sha256', webhookSecret)
                .update(signedPayload)
                .digest('hex');
            const hashBuffer = Buffer.from(computedHash, 'hex');
            for (const sig of signatures) {
                const sigBuffer = Buffer.from(sig, 'hex');
                if (sigBuffer.length === hashBuffer.length && crypto_1.default.timingSafeEqual(sigBuffer, hashBuffer)) {
                    return true;
                }
            }
            return false;
        }
        catch (err) {
            logger_1.default.error('Error during Stripe webhook signature verification:', err);
            return false;
        }
    }
}
exports.default = new StripeModule();
