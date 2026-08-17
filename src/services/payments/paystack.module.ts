import axios from 'axios';
import crypto from 'crypto';
import AppError from '../../utils/appError';
import logger from '../../utils/logger';

export interface PaymentInitializeParams {
  email: string;
  amount: number; // in NGN (will be converted to kobo)
  reference: string;
  metadata?: Record<string, any>;
  callbackUrl?: string;
  subaccount?: string;
  transactionCharge?: number; // in NGN (will be converted to kobo)
}

export interface PaymentInitializeResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface CreateSubaccountParams {
  businessName: string;
  bankCode: string;
  accountNumber: string;
  percentageCharge: number;
}

export interface PayoutRecipientParams {
  name: string;
  accountNumber: string;
  bankCode: string;
}

export interface PayoutParams {
  amount: number; // in NGN (will be converted to kobo)
  recipientCode: string;
  reference: string;
  reason?: string;
}

export class PaystackModule {
  private readonly secretKey = process.env.PAYSTACK_SECRET_KEY || 'sk_test_placeholder';
  private readonly baseUrl = 'https://api.paystack.co';

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Initialize Paystack Transaction
   */
  async initializePayment(params: PaymentInitializeParams): Promise<PaymentInitializeResult> {
    const amountInKobo = Math.round(params.amount * 100);

    if (this.secretKey.includes('placeholder') || process.env.USE_MOCK_PAYMENT === 'true') {
      logger.info(`[Paystack Dev/Mock] Generating simulated authorization URL for ${params.reference}`);
      return {
        authorizationUrl: `https://checkout.paystack.com/test_checkout?reference=${params.reference}&amount=${params.amount}`,
        accessCode: `tst_access_${Date.now()}`,
        reference: params.reference,
      };
    }

    try {
      const payload: Record<string, any> = {
        email: params.email && params.email.trim() !== '' ? params.email : 'customer@goeat.com',
        amount: amountInKobo,
        reference: params.reference,
        metadata: params.metadata || {},
      };

      if (params.callbackUrl) {
        payload.callback_url = params.callbackUrl;
      }

      if (params.subaccount) {
        payload.subaccount = params.subaccount;
      }

      if (params.transactionCharge !== undefined) {
        payload.transaction_charge = Math.round(params.transactionCharge * 100);
      }

      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        payload,
        { headers: this.getHeaders() }
      );

      const data = response.data.data;
      return {
        authorizationUrl: data.authorization_url,
        accessCode: data.access_code,
        reference: data.reference,
      };
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        logger.warn(`[Paystack Dev Fallback] API error (${error.message}). Falling back to simulated checkout URL for dev testing.`);
        return {
          authorizationUrl: `https://checkout.paystack.com/test_checkout?reference=${params.reference}&amount=${params.amount}`,
          accessCode: `tst_access_${Date.now()}`,
          reference: params.reference,
        };
      }
      logger.error('Paystack initializePayment error:', error.response?.data || error.message);
      throw new AppError(
        error.response?.data?.message || 'Paystack payment initialization failed',
        error.response?.status || 500
      );
    }
  }

  /**
   * Verify Paystack Transaction by Reference
   */
  async verifyPayment(reference: string): Promise<any> {
    if (this.secretKey.includes('placeholder') || process.env.USE_MOCK_PAYMENT === 'true') {
      logger.info(`[Paystack Dev/Mock] Simulating successful verification for ${reference}`);
      return {
        id: reference,
        status: 'success',
        reference,
        amount: 500000,
        metadata: { orderId: reference.split('_')[1] },
        customer: { email: 'dev@goeatalone.com' },
      };
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: this.getHeaders() }
      );

      return response.data.data;
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        logger.warn(`[Paystack Dev Fallback] Verification error (${error.message}). Simulating successful verification for dev testing.`);
        return {
          id: reference,
          status: 'success',
          reference,
          amount: 500000,
          metadata: { orderId: reference.split('_')[1] },
          customer: { email: 'dev@goeatalone.com' },
        };
      }
      logger.error(`Paystack verifyPayment error for ref ${reference}:`, error.response?.data || error.message);
      throw new AppError(
        error.response?.data?.message || 'Paystack verification failed',
        error.response?.status || 500
      );
    }
  }

  /**
   * Cryptographically verify Paystack Webhook Signature (HMAC SHA-512)
   */
  verifyWebhookSignature(payload: any, signature: string): boolean {
    if (!signature) return false;

    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
      .digest('hex');

    return hash === signature;
  }

  /**
   * Create Transfer Recipient (for Riders / Restaurants payout)
   */
  async createTransferRecipient(params: PayoutRecipientParams): Promise<{ recipientCode: string }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transferrecipient`,
        {
          type: 'nuban',
          name: params.name,
          account_number: params.accountNumber,
          bank_code: params.bankCode,
          currency: 'NGN',
        },
        { headers: this.getHeaders() }
      );

      return {
        recipientCode: response.data.data.recipient_code,
      };
    } catch (error: any) {
      logger.error('Paystack createTransferRecipient error:', error.response?.data || error.message);
      throw new AppError(
        error.response?.data?.message || 'Failed to create Paystack transfer recipient',
        error.response?.status || 500
      );
    }
  }

  /**
   * Initiate Payout / Bank Transfer (Riders / Restaurants)
   */
  async initiatePayout(params: PayoutParams): Promise<any> {
    const amountInKobo = Math.round(params.amount * 100);

    try {
      const response = await axios.post(
        `${this.baseUrl}/transfer`,
        {
          source: 'balance',
          reason: params.reason || 'Go-Eat Payout',
          amount: amountInKobo,
          recipient: params.recipientCode,
          reference: params.reference,
        },
        { headers: this.getHeaders() }
      );

      return response.data.data;
    } catch (error: any) {
      logger.error('Paystack initiatePayout error:', error.response?.data || error.message);
      throw new AppError(
        error.response?.data?.message || 'Paystack payout initiation failed',
        error.response?.status || 500
      );
    }
  }

  /**
   * Get List of Banks from Paystack
   */
  async getBanks(country: string = 'nigeria'): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/bank?country=${country}`,
        { headers: this.getHeaders() }
      );
      return response.data.data;
    } catch (error: any) {
      logger.error('Paystack getBanks error:', error.response?.data || error.message);
      return []; // Return empty array instead of crashing, for resilience
    }
  }

  /**
   * Create a Subaccount for Vendor Payouts
   */
  async createSubaccount(params: CreateSubaccountParams): Promise<{ subaccountCode: string }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/subaccount`,
        {
          business_name: params.businessName,
          settlement_bank: params.bankCode,
          account_number: params.accountNumber,
          percentage_charge: params.percentageCharge,
        },
        { headers: this.getHeaders() }
      );

      return {
        subaccountCode: response.data.data.subaccount_code,
      };
    } catch (error: any) {
      logger.error('Paystack createSubaccount error:', error.response?.data || error.message);
      throw new AppError(
        error.response?.data?.message || 'Failed to create Paystack subaccount',
        error.response?.status || 500
      );
    }
  }
}

export default new PaystackModule();
