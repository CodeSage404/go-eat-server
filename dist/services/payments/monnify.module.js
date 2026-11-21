"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonnifyModule = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const appError_1 = __importDefault(require("../../utils/appError"));
const logger_1 = __importDefault(require("../../utils/logger"));
class MonnifyModule {
    constructor() {
        this.lastLoadedSecretKey = '';
        // Token cache to prevent re-authenticating on every HTTP request
        this.cachedToken = null;
        this.tokenExpiresAt = 0;
    }
    /**
     * Dynamically resolve credentials from Admin Settings (DB) or fallback to Environment (.env)
     */
    async getCredentials() {
        let setting = null;
        try {
            const SettingModel = require('../../models/setting.model').default;
            setting = await SettingModel.findOne();
        }
        catch (e) {
            // Ignore DB fetch errors, fallback to env
        }
        const apiKey = (setting?.monnifyApiKey || process.env.MONNIFY_API_KEY || '').trim();
        const secretKey = (setting?.monnifySecretKey || process.env.MONNIFY_SECRET_KEY || '').trim();
        const contractCode = (setting?.monnifyContractCode || process.env.MONNIFY_CONTRACT_CODE || '').trim();
        const walletAccountNumber = (setting?.monnifyWalletAccountNumber || process.env.MONNIFY_WALLET_ACCOUNT_NUMBER || '').trim();
        if (secretKey) {
            this.lastLoadedSecretKey = secretKey;
        }
        let baseUrl = process.env.MONNIFY_BASE_URL;
        if (!baseUrl) {
            if (setting?.monnifyMode === 'live') {
                baseUrl = 'https://api.monnify.com';
            }
            else if (setting?.monnifyMode === 'sandbox') {
                baseUrl = 'https://sandbox.monnify.com';
            }
            else {
                baseUrl = process.env.NODE_ENV === 'production'
                    ? 'https://api.monnify.com'
                    : 'https://sandbox.monnify.com';
            }
        }
        return {
            apiKey,
            secretKey,
            contractCode,
            walletAccountNumber,
            baseUrl: baseUrl.replace(/\/$/, ''),
        };
    }
    /**
     * Fetch or return cached Monnify OAuth2 Bearer Access Token
     */
    async getAccessToken() {
        const now = Math.floor(Date.now() / 1000);
        if (this.cachedToken && this.tokenExpiresAt > now + 60) {
            return this.cachedToken;
        }
        const creds = await this.getCredentials();
        if (!creds.apiKey || !creds.secretKey) {
            throw new appError_1.default('Monnify API credentials are not properly configured. Please configure them in the Admin Settings or .env', 500);
        }
        try {
            const basicAuth = Buffer.from(`${creds.apiKey}:${creds.secretKey}`).toString('base64');
            const response = await axios_1.default.post(`${creds.baseUrl}/api/v1/auth/login`, {}, {
                headers: {
                    Authorization: `Basic ${basicAuth}`,
                    'Content-Type': 'application/json',
                },
            });
            const responseBody = response.data?.responseBody;
            if (!responseBody?.accessToken) {
                throw new Error('No access token returned by Monnify');
            }
            const token = responseBody.accessToken;
            this.cachedToken = token;
            this.tokenExpiresAt = now + (responseBody.expiresIn || 3600);
            return token;
        }
        catch (error) {
            logger_1.default.error('Monnify authentication failed:', error.response?.data || error.message);
            throw new appError_1.default(error.response?.data?.responseMessage || 'Failed to authenticate with Monnify payment gateway', error.response?.status || 500);
        }
    }
    /**
     * Helper to get authorized headers
     */
    async getAuthHeaders() {
        const token = await this.getAccessToken();
        return {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
    }
    /**
     * Initialize a Monnify transaction (Card + Dynamic Bank Transfer)
     */
    async initializePayment(params) {
        const creds = await this.getCredentials();
        if (!creds.contractCode) {
            throw new appError_1.default('Monnify Contract Code is not configured. Please set it in Admin Settings.', 500);
        }
        try {
            const headers = await this.getAuthHeaders();
            const payload = {
                amount: params.amount,
                customerName: params.name || 'GoEat Customer',
                customerEmail: params.email && params.email.trim() !== '' ? params.email : 'customer@goeat.com',
                paymentReference: params.reference,
                paymentDescription: params.description || 'Go-Eat Order Payment',
                currencyCode: 'NGN',
                contractCode: creds.contractCode,
                redirectUrl: params.callbackUrl,
                paymentMethods: ['CARD', 'ACCOUNT_TRANSFER'],
                metaData: params.metadata || {},
            };
            // Support split payment if vendor subaccount is configured
            if (params.subaccount) {
                payload.incomeSplitConfig = [
                    {
                        subAccountCode: params.subaccount,
                        feePercentage: params.transactionCharge !== undefined ? params.transactionCharge : 85,
                        feeBearer: false,
                    },
                ];
            }
            const response = await axios_1.default.post(`${creds.baseUrl}/api/v1/merchant/transactions/init-transaction`, payload, { headers });
            const body = response.data?.responseBody;
            if (!body) {
                throw new Error('Invalid response body received from Monnify initialize transaction');
            }
            return {
                authorizationUrl: body.checkoutUrl,
                accessCode: body.transactionReference,
                reference: body.paymentReference || params.reference,
            };
        }
        catch (error) {
            logger_1.default.error('Monnify initializePayment error:', error.response?.data || error.message);
            throw new appError_1.default(error.response?.data?.responseMessage || 'Monnify payment initialization failed', error.response?.status || 500);
        }
    }
    /**
     * Verify Monnify Transaction status
     */
    async verifyPayment(reference) {
        const creds = await this.getCredentials();
        try {
            const headers = await this.getAuthHeaders();
            // First try querying by paymentReference
            let response;
            try {
                response = await axios_1.default.get(`${creds.baseUrl}/api/v1/merchant/transactions/query?paymentReference=${encodeURIComponent(reference)}`, { headers });
            }
            catch (err) {
                // Fallback to checking by transactionReference if paymentReference didn't match
                response = await axios_1.default.get(`${creds.baseUrl}/api/v2/transactions/${encodeURIComponent(reference)}`, { headers });
            }
            const body = response.data?.responseBody;
            return body;
        }
        catch (error) {
            logger_1.default.error(`Monnify verifyPayment error for ref ${reference}:`, error.response?.data || error.message);
            throw new appError_1.default(error.response?.data?.responseMessage || 'Monnify transaction verification failed', error.response?.status || 500);
        }
    }
    /**
     * Verify Monnify Webhook Signature using SHA512 HMAC
     */
    verifyWebhookSignature(payload, signature) {
        const secretKey = this.lastLoadedSecretKey || process.env.MONNIFY_SECRET_KEY || '';
        if (!signature || !secretKey)
            return false;
        try {
            const rawBody = Buffer.isBuffer(payload)
                ? payload.toString('utf8')
                : typeof payload === 'string'
                    ? payload
                    : JSON.stringify(payload);
            const computedHash = crypto_1.default
                .createHmac('sha512', secretKey)
                .update(rawBody)
                .digest('hex');
            const signatureBuffer = Buffer.from(signature, 'hex');
            const hashBuffer = Buffer.from(computedHash, 'hex');
            if (signatureBuffer.length !== hashBuffer.length) {
                return false;
            }
            return crypto_1.default.timingSafeEqual(signatureBuffer, hashBuffer);
        }
        catch (err) {
            logger_1.default.error('Error during Monnify timing-safe webhook signature verification:', err);
            return false;
        }
    }
    /**
     * Get List of Nigerian Banks from Monnify
     */
    async getBanks() {
        try {
            const creds = await this.getCredentials();
            const headers = await this.getAuthHeaders();
            const response = await axios_1.default.get(`${creds.baseUrl}/api/v1/banks`, { headers });
            const banks = response.data?.responseBody || [];
            // Normalize format to match Paystack ({ name, code, slug })
            return banks.map((b) => ({
                name: b.name,
                code: b.code,
                slug: (b.name || '').toLowerCase().replace(/[^a-z0-9]/g, '-'),
                ussdCode: b.ussdCode,
            }));
        }
        catch (error) {
            logger_1.default.error('Monnify getBanks error:', error.response?.data || error.message);
            return [];
        }
    }
    /**
     * Resolve and Validate Bank Account Number & Name
     */
    async resolveAccountNumber(accountNumber, bankCode) {
        try {
            const creds = await this.getCredentials();
            const headers = await this.getAuthHeaders();
            const response = await axios_1.default.get(`${creds.baseUrl}/api/v1/disbursements/account/validate?accountNumber=${encodeURIComponent(accountNumber)}&bankCode=${encodeURIComponent(bankCode)}`, { headers });
            const body = response.data?.responseBody;
            if (!body || !body.accountName) {
                throw new Error('Account could not be validated by Monnify');
            }
            return {
                accountNumber: body.accountNumber || accountNumber,
                accountName: body.accountName,
            };
        }
        catch (error) {
            logger_1.default.error('Monnify resolveAccountNumber error:', error.response?.data || error.message);
            throw new appError_1.default(error.response?.data?.responseMessage || 'Failed to resolve bank account number with Monnify', error.response?.status || 400);
        }
    }
    /**
     * Create a Subaccount for Vendor automatic split payments
     */
    async createSubaccount(params) {
        try {
            const creds = await this.getCredentials();
            const headers = await this.getAuthHeaders();
            const payload = [
                {
                    currencyCode: 'NGN',
                    accountNumber: params.accountNumber,
                    bankCode: params.bankCode,
                    email: params.email,
                    defaultSplitPercentage: params.percentageCharge,
                },
            ];
            const response = await axios_1.default.post(`${creds.baseUrl}/api/v1/sub-accounts`, payload, {
                headers,
            });
            const body = response.data?.responseBody;
            const created = Array.isArray(body) ? body[0] : body;
            if (!created?.subAccountCode) {
                throw new Error('No subaccount code returned by Monnify');
            }
            return {
                subaccountCode: created.subAccountCode,
            };
        }
        catch (error) {
            logger_1.default.error('Monnify createSubaccount error:', error.response?.data || error.message);
            throw new appError_1.default(error.response?.data?.responseMessage || 'Failed to create Monnify subaccount', error.response?.status || 500);
        }
    }
    /**
     * Initiate Single Bank Disbursement (Payout to Rider or Restaurant)
     */
    async initiatePayout(params) {
        const creds = await this.getCredentials();
        if (!creds.walletAccountNumber) {
            throw new appError_1.default('Monnify source wallet account number is not configured for disbursements.', 500);
        }
        try {
            const headers = await this.getAuthHeaders();
            const payload = {
                amount: params.amount,
                reference: params.reference,
                narration: params.reason || 'Go-Eat Payout',
                destinationBankCode: params.bankCode,
                destinationAccountNumber: params.accountNumber,
                currency: 'NGN',
                sourceAccountNumber: creds.walletAccountNumber,
            };
            const response = await axios_1.default.post(`${creds.baseUrl}/api/v2/disbursements/single`, payload, {
                headers,
            });
            return response.data?.responseBody;
        }
        catch (error) {
            logger_1.default.error('Monnify initiatePayout error:', error.response?.data || error.message);
            throw new appError_1.default(error.response?.data?.responseMessage || 'Monnify disbursement initiation failed', error.response?.status || 500);
        }
    }
    /**
     * Initiate a Refund via Monnify
     */
    async refundTransaction(params) {
        try {
            const creds = await this.getCredentials();
            const headers = await this.getAuthHeaders();
            const payload = {
                transactionReference: params.reference,
                refundReason: params.reason || 'Customer order refund',
                customerNote: params.reason || 'Customer order refund',
            };
            if (params.amount && params.amount > 0) {
                payload.refundAmount = params.amount;
            }
            const response = await axios_1.default.post(`${creds.baseUrl}/api/v1/refunds/initiate-refund`, payload, {
                headers,
            });
            logger_1.default.info(`✅ Monnify refund submitted for ref ${params.reference}`);
            return response.data?.responseBody;
        }
        catch (error) {
            logger_1.default.error('Monnify refundTransaction error:', error.response?.data || error.message);
            throw new appError_1.default(error.response?.data?.responseMessage || 'Failed to process refund with Monnify', error.response?.status || 500);
        }
    }
}
exports.MonnifyModule = MonnifyModule;
exports.default = new MonnifyModule();
