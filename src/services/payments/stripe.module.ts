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
  private readonly baseUrl = 'https://api.stripe.com/v1';

  private get secretKey(): string {
    return process.env.STRIPE_SECRET_KEY || '';
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
    const email = params.email && params.email.trim() !== '' ? params.email : 'support@goeatone.com';
    const currency = (params.currency || 'gbp').toLowerCase();

    if (!this.secretKey) {
      throw new AppError('Stripe payment gateway is not properly configured. Missing STRIPE_SECRET_KEY in environment.', 500);
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
    if (!this.secretKey) {
      throw new AppError('Stripe payment gateway is not properly configured. Missing STRIPE_SECRET_KEY in environment.', 500);
    }

    try {
      let session: any = null;

      // 1. If reference is a Stripe checkout session id (cs_...)
      if (reference.startsWith('cs_')) {
        const response = await axios.get(`${this.baseUrl}/checkout/sessions/${reference}`, {
          headers: this.getHeaders(),
        });
        session = response.data;
      } else {
        // 2. Query recent sessions and match by client_reference_id
        const response = await axios.get(`${this.baseUrl}/checkout/sessions?limit=50`, {
          headers: this.getHeaders(),
        });
        const sessions = response.data?.data || [];
        session = sessions.find((s: any) => s.client_reference_id === reference);
      }

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
          orderId: session.metadata?.orderId || (session.client_reference_id ? session.client_reference_id.split('_')[1] : undefined),
          orderIds: session.metadata?.orderIds,
          customerId: session.metadata?.customerId,
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
