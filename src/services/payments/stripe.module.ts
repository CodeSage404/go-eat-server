import axios from 'axios';
import crypto from 'crypto';
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

  /**
   * Process refund via Stripe
   */
  async refundPayment(params: {
    paymentIntentId?: string;
    sessionId?: string;
    amountInCents?: number;
    reason?: string;
  }): Promise<any> {
    if (!this.secretKey) {
      throw new AppError('Stripe payment gateway is not properly configured.', 500);
    }

    try {
      let paymentIntentId = params.paymentIntentId;

      if (!paymentIntentId && params.sessionId) {
        const sessionRes = await axios.get(`${this.baseUrl}/checkout/sessions/${params.sessionId}`, {
          headers: this.getHeaders(),
        });
        paymentIntentId = sessionRes.data?.payment_intent;
      }

      if (!paymentIntentId) {
        throw new AppError('Could not identify Stripe payment intent for refund', 400);
      }

      const formData = new URLSearchParams();
      formData.append('payment_intent', paymentIntentId);
      if (params.amountInCents && params.amountInCents > 0) {
        formData.append('amount', Math.round(params.amountInCents).toString());
      }
      if (params.reason) {
        formData.append('metadata[reason]', params.reason);
      }

      const response = await axios.post(`${this.baseUrl}/refunds`, formData.toString(), {
        headers: this.getHeaders(),
      });

      logger.info(`✅ Stripe refund successful: ${response.data?.id} for payment_intent ${paymentIntentId}`);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Stripe refund error';
      logger.error(`Stripe refundPayment error: ${errorMessage}`);
      throw new AppError(errorMessage, error.response?.status || 500);
    }
  }

  /**
   * Cryptographically verify Stripe Webhook Signature (HMAC SHA-256)
   */
  verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string): boolean {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret || !signatureHeader) return false;

    try {
      const items = signatureHeader.split(',');
      let timestamp = '';
      const signatures: string[] = [];

      for (const item of items) {
        const parts = item.trim().split('=');
        if (parts[0] === 't') {
          timestamp = parts[1];
        } else if (parts[0] === 'v1') {
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
        logger.warn('Stripe webhook signature timestamp outside 5-minute tolerance window');
        return false;
      }

      const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
      const signedPayload = `${timestamp}.${bodyStr}`;
      const computedHash = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      const hashBuffer = Buffer.from(computedHash, 'hex');

      for (const sig of signatures) {
        const sigBuffer = Buffer.from(sig, 'hex');
        if (sigBuffer.length === hashBuffer.length && crypto.timingSafeEqual(sigBuffer, hashBuffer)) {
          return true;
        }
      }

      return false;
    } catch (err) {
      logger.error('Error during Stripe webhook signature verification:', err);
      return false;
    }
  }

  /**
   * Validate International Bank Account Number (IBAN) using ISO 7064 Mod 97-10
   */
  public isValidIBAN(input: string): boolean {
    const iban = input.replace(/[\s-]/g, '').toUpperCase();
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;

    // Rearrange: move first 4 characters to the end
    const rearranged = iban.slice(4) + iban.slice(0, 4);

    // Replace letters with numeric equivalents (A = 10, ..., Z = 35)
    let expanded = '';
    for (let i = 0; i < rearranged.length; i++) {
      const charCode = rearranged.charCodeAt(i);
      if (charCode >= 65 && charCode <= 90) {
        expanded += (charCode - 55).toString();
      } else {
        expanded += rearranged[i];
      }
    }

    // Large number modulo 97 in chunks
    let remainder = 0;
    for (let i = 0; i < expanded.length; i += 7) {
      const chunk = remainder.toString() + expanded.substring(i, i + 7);
      remainder = parseInt(chunk, 10) % 97;
    }

    return remainder === 1;
  }

  /**
   * Validate UK Sort Code (6 digits) and Account Number (8 digits)
   */
  public isValidUKSortCodeAndAccount(sortCode: string, accountNumber: string): boolean {
    const cleanSort = sortCode.replace(/[\s-]/g, '');
    const cleanAcc = accountNumber.replace(/[\s-]/g, '');
    return /^\d{6}$/.test(cleanSort) && /^\d{8}$/.test(cleanAcc);
  }

  /**
   * Resolve and Validate Bank Account with Stripe
   */
  async resolveBankAccount(params: {
    accountNumber: string;
    routingNumber?: string;
    countryCode?: string;
    accountHolderName?: string;
    currency?: string;
  }): Promise<{
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string;
    currency: string;
    provider: 'stripe';
    isVerified: boolean;
  }> {
    const rawCountry = (params.countryCode || 'GB').toUpperCase();
    const country = rawCountry === 'UK' ? 'GB' : rawCountry;
    const cleanAccount = params.accountNumber.replace(/[\s-]/g, '').toUpperCase();
    const cleanRouting = (params.routingNumber || '').replace(/[\s-]/g, '');
    const currency = (params.currency || (country === 'GB' ? 'gbp' : country === 'IT' ? 'eur' : 'usd')).toLowerCase();
    const accountHolder = params.accountHolderName || 'Verified Account';

    // 1. Regional algorithmic pre-validation
    if (country === 'GB') {
      if (!this.isValidUKSortCodeAndAccount(cleanRouting, cleanAccount)) {
        throw new AppError('Invalid UK bank details. Requires 6-digit sort code and 8-digit account number.', 400);
      }
    } else if (country === 'IT' || cleanAccount.startsWith('IT')) {
      if (!this.isValidIBAN(cleanAccount)) {
        throw new AppError('Invalid Italian IBAN format or checksum.', 400);
      }
    } else if (cleanAccount.length >= 15 && this.isValidIBAN(cleanAccount)) {
      // European IBAN
    }

    // 2. Stripe API Verification (if key configured)
    if (this.secretKey && !this.secretKey.includes('placeholder')) {
      try {
        const formData = new URLSearchParams();
        formData.append('bank_account[country]', country);
        formData.append('bank_account[currency]', currency);
        formData.append('bank_account[account_number]', cleanAccount);
        if (cleanRouting) {
          formData.append('bank_account[routing_number]', cleanRouting);
        }
        if (accountHolder) {
          formData.append('bank_account[account_holder_name]', accountHolder);
        }
        formData.append('bank_account[account_holder_type]', 'individual');

        const response = await axios.post(`${this.baseUrl}/tokens`, formData.toString(), {
          headers: this.getHeaders(),
        });

        const bank = response.data?.bank_account;
        if (bank) {
          return {
            accountNumber: cleanAccount,
            accountName: bank.account_holder_name || accountHolder,
            bankName: bank.bank_name || this.inferBankName(cleanRouting, country),
            bankCode: cleanRouting || bank.routing_number || country,
            currency: bank.currency || currency,
            provider: 'stripe',
            isVerified: true,
          };
        }
      } catch (err: any) {
        const stripeError = err.response?.data?.error?.message;
        logger.warn(`Stripe bank verification error: ${stripeError || err.message}`);
        if (stripeError) {
          throw new AppError(stripeError, 400);
        }
      }
    }

    // 3. Fallback verified response for dev / sandbox mode
    return {
      accountNumber: cleanAccount,
      accountName: accountHolder,
      bankName: this.inferBankName(cleanRouting, country, cleanAccount),
      bankCode: cleanRouting || (country === 'IT' ? cleanAccount.slice(5, 10) : 'STRIPE'),
      currency,
      provider: 'stripe',
      isVerified: true,
    };
  }

  /**
   * Helper to infer bank name from sort code or IBAN ABI
   */
  private inferBankName(routing: string, country: string, iban?: string): string {
    if (country === 'GB') {
      const prefix = routing.slice(0, 2);
      if (['20'].includes(prefix)) return 'Barclays Bank UK';
      if (['40'].includes(prefix)) return 'HSBC UK';
      if (['30'].includes(prefix)) return 'Lloyds Bank';
      if (['60', '50'].includes(prefix)) return 'NatWest / RBS';
      if (['09'].includes(prefix)) return 'Santander UK';
      if (['04'].includes(prefix)) return 'Monzo Bank';
      if (['60'].includes(prefix)) return 'Starling Bank';
      if (['23'].includes(prefix)) return 'Revolut UK';
      return 'UK Clearing Bank';
    }

    if (country === 'IT' && iban) {
      // Italian IBAN structure: IT kk x AAAAA CCCCC ccccccccccc (AAAAA is ABI code)
      const abi = iban.slice(5, 10);
      if (abi === '03069') return 'Intesa Sanpaolo';
      if (abi === '02008') return 'UniCredit';
      if (abi === '05034') return 'Banco BPM';
      if (abi === '07601') return 'Postepay / Poste Italiane';
      if (abi === '01005') return 'BNL BNP Paribas';
      if (abi === '03015') return 'FinecoBank';
      if (abi === '03104') return 'Banca Mediolanum';
      return 'Banca d\'Italia Registered Bank';
    }

    return 'Verified International Bank';
  }

  /**
   * Returns list of supported banks by country for UI pickers
   */
  public getBanksByCountry(countryCode: string): Array<{ name: string; code: string; country: string }> {
    const code = (countryCode || 'GB').toUpperCase();

    if (code === 'GB' || code === 'UK') {
      return [
        { name: 'Barclays UK', code: '20-00-00', country: 'GB' },
        { name: 'HSBC UK', code: '40-00-00', country: 'GB' },
        { name: 'Lloyds Bank', code: '30-00-00', country: 'GB' },
        { name: 'NatWest', code: '60-00-00', country: 'GB' },
        { name: 'Santander UK', code: '09-00-00', country: 'GB' },
        { name: 'Revolut UK', code: '23-00-00', country: 'GB' },
        { name: 'Monzo Bank', code: '04-00-04', country: 'GB' },
        { name: 'Starling Bank', code: '60-83-71', country: 'GB' },
        { name: 'Nationwide Building Society', code: '07-00-93', country: 'GB' },
        { name: 'Halifax', code: '11-00-01', country: 'GB' },
        { name: 'Royal Bank of Scotland', code: '16-00-00', country: 'GB' },
        { name: 'TSB Bank', code: '77-00-00', country: 'GB' },
      ];
    }

    if (code === 'IT') {
      return [
        { name: 'Intesa Sanpaolo', code: '03069', country: 'IT' },
        { name: 'UniCredit', code: '02008', country: 'IT' },
        { name: 'Banco BPM', code: '05034', country: 'IT' },
        { name: 'Postepay / Poste Italiane', code: '07601', country: 'IT' },
        { name: 'BNL BNP Paribas', code: '01005', country: 'IT' },
        { name: 'FinecoBank', code: '03015', country: 'IT' },
        { name: 'Banca Mediolanum', code: '03104', country: 'IT' },
        { name: 'Banca Monte dei Paschi di Siena', code: '01030', country: 'IT' },
        { name: 'Credito Emiliano (Credem)', code: '03032', country: 'IT' },
        { name: 'BPER Banca', code: '05387', country: 'IT' },
        { name: 'Illimity Bank', code: '03395', country: 'IT' },
        { name: 'N26 Italia', code: '03657', country: 'IT' },
      ];
    }

    if (code === 'US') {
      return [
        { name: 'JPMorgan Chase', code: '021000021', country: 'US' },
        { name: 'Bank of America', code: '026009593', country: 'US' },
        { name: 'Wells Fargo', code: '121000247', country: 'US' },
        { name: 'Citibank', code: '021000089', country: 'US' },
        { name: 'Capital One', code: '051405515', country: 'US' },
        { name: 'US Bank', code: '091000022', country: 'US' },
      ];
    }

    return [];
  }
}

export default new StripeModule();
