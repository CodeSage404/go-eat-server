import axios from 'axios';
import logger from '../../utils/logger';
import AppError from '../../utils/appError';

export interface StripeInitializeParams {
  email: string;
  amount: number; // in base currency units
  reference: string;
  currency?: string;
  redirectUrl?: string;
  metadata?: Record<string, any>;
}

export interface StripeInitializeResult {
  authorizationUrl: string;
  reference: string;
  sessionId?: string;
}

class StripeModule {
  private readonly secretKey: string;
  private readonly baseUrl = 'https://api.stripe.com/v1';

  constructor() {
    this.secretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key';
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }

  /**
   * Initialize Stripe Checkout Session
   */
  async initializePayment(params: StripeInitializeParams): Promise<StripeInitializeResult> {
    const amountInCents = Math.round(params.amount * 100);
    const email = params.email && params.email.trim() !== '' ? params.email : 'customer@goeat.com';

    if (!this.secretKey || this.secretKey.includes('placeholder')) {
      throw new AppError('Stripe payment gateway is not properly configured.', 500);
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

      const response = await axios.post(`${this.baseUrl}/checkout/sessions`, formData.toString(), {
        headers: this.getHeaders(),
      });

      return {
        authorizationUrl: response.data.url,
        reference: params.reference,
        sessionId: response.data.id,
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Stripe error';
      logger.error(`Stripe initializePayment error: ${errorMessage}`);
      throw new AppError(errorMessage, error.response?.status || 500);
    }
  }

  /**
   * Verify Payment Status from Stripe
   */
  async verifyPayment(reference: string): Promise<any> {
    if (!this.secretKey || this.secretKey.includes('placeholder')) {
      throw new AppError('Stripe payment gateway is not properly configured.', 500);
    }

    try {
      const response = await axios.get(`${this.baseUrl}/checkout/sessions?client_reference_id=${reference}`, {
        headers: this.getHeaders(),
      });

      const session = response.data.data && response.data.data[0];
      if (!session) {
        throw new AppError('Transaction not found on Stripe', 404);
      }

      if (session.payment_status !== 'paid') {
        throw new AppError(`Stripe payment was not successful (status: ${session.payment_status})`, 400);
      }

      return {
        id: session.id,
        status: 'success',
        metadata: {
          orderId: session.client_reference_id ? session.client_reference_id.split('_')[1] : undefined,
        },
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Stripe error';
      logger.error(`Stripe verifyPayment error: ${errorMessage}`);
      throw new AppError(errorMessage, error.response?.status || 500);
    }
  }
}

export default new StripeModule();
