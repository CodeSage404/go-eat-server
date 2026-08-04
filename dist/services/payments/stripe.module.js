"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../../utils/logger"));
class StripeModule {
    constructor() {
        this.baseUrl = 'https://api.stripe.com/v1';
        this.secretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key';
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
        const email = params.email && params.email.trim() !== '' ? params.email : 'customer@goeat.com';
        if (this.secretKey.includes('placeholder') || process.env.USE_MOCK_PAYMENT === 'true') {
            logger_1.default.info(`[Stripe Dev/Mock] Generating simulated authorization URL for ${params.reference}`);
            return {
                authorizationUrl: `https://checkout.stripe.com/test_checkout?reference=${params.reference}&amount=${params.amount}`,
                reference: params.reference,
                sessionId: `cs_test_${Date.now()}`,
            };
        }
        try {
            const formData = new URLSearchParams();
            formData.append('payment_method_types[]', 'card');
            formData.append('line_items[0][price_data][currency]', (params.currency || 'usd').toLowerCase());
            formData.append('line_items[0][price_data][product_data][name]', 'Go-Eat Order');
            formData.append('line_items[0][price_data][unit_amount]', amountInCents.toString());
            formData.append('line_items[0][quantity]', '1');
            formData.append('mode', 'payment');
            formData.append('success_url', params.redirectUrl || `https://api.goeatalone.com/payment/callback?reference=${params.reference}&provider=stripe`);
            formData.append('cancel_url', params.redirectUrl || `https://api.goeatalone.com/payment/callback?reference=${params.reference}&provider=stripe&status=cancelled`);
            formData.append('client_reference_id', params.reference);
            formData.append('customer_email', email);
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
            throw new Error(errorMessage);
        }
    }
    /**
     * Verify Payment Status from Stripe
     */
    async verifyPayment(reference) {
        if (this.secretKey.includes('placeholder') || process.env.USE_MOCK_PAYMENT === 'true') {
            logger_1.default.info(`[Stripe Dev/Mock] Verifying simulated transaction for ${reference}`);
            return {
                id: `stripe_${reference}`,
                status: 'success',
                metadata: {
                    orderId: reference.split('_')[1],
                },
            };
        }
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/checkout/sessions?client_reference_id=${reference}`, {
                headers: this.getHeaders(),
            });
            const session = response.data.data && response.data.data[0];
            if (!session) {
                throw new Error('Transaction not found on Stripe');
            }
            return {
                id: session.id,
                status: session.payment_status === 'paid' ? 'success' : session.payment_status,
                metadata: {
                    orderId: session.client_reference_id ? session.client_reference_id.split('_')[1] : undefined,
                },
            };
        }
        catch (error) {
            const errorMessage = error.response?.data?.error?.message || error.message || 'Stripe error';
            logger_1.default.error(`Stripe verifyPayment error: ${errorMessage}`);
            throw new Error(errorMessage);
        }
    }
}
exports.default = new StripeModule();
