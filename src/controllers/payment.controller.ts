import { Request, Response } from 'express';
import paymentService, { PaymentProvider } from '../services/payment.service';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import Order from '../models/order.model';
import Restaurant from '../models/restaurant.model';
import Setting from '../models/setting.model';
import paystackModule from '../services/payments/paystack.module';
import stripeModule from '../services/payments/stripe.module';
import { resolveRequestLocation } from '../utils/locationResolver';
import logger from '../utils/logger';

class PaymentController {
  /**
   * Initialize a new Payment (Paystack or Flutterwave)
   */
  public initializePayment = catchAsync(async (req: Request, res: Response) => {
    const { orderId, provider, callbackUrl } = req.body;
    if (!orderId) {
      throw new AppError('orderId is required', 400);
    }

    const paymentData = await paymentService.initializePayment(
      orderId,
      req.user!._id.toString(),
      provider as PaymentProvider,
      callbackUrl
    );

    res.status(200).json({
      status: 'success',
      data: {
        authorizationUrl: paymentData.authorizationUrl,
        accessCode: paymentData.accessCode,
        reference: paymentData.reference,
        provider: paymentData.provider,
      },
    });
  });

  /**
   * Get active payment providers based on location & admin settings
   */
  public getActivePaymentProviders = catchAsync(async (req: Request, res: Response) => {
    const countryCode = String(req.query.countryCode || '').toUpperCase();
    const setting = await Setting.findOne();

    const paystackEnabled = setting?.enablePaystack !== false;
    const flutterwaveEnabled = setting?.enableFlutterwave !== false;
    const stripeEnabled = setting?.enableStripe !== false;

    const allDisabled = !paystackEnabled && !flutterwaveEnabled && !stripeEnabled;

    let forcedProvider = setting?.forceGlobalPaymentProvider || 'none';
    if (forcedProvider !== 'none') {
      if (forcedProvider === 'stripe' && !stripeEnabled) forcedProvider = 'none';
      if (forcedProvider === 'paystack' && !paystackEnabled) forcedProvider = 'none';
      if (forcedProvider === 'flutterwave' && !flutterwaveEnabled) forcedProvider = 'none';
    }

    let activeProviders: string[] = [];
    let defaultProvider: string = 'stripe';

    if (forcedProvider !== 'none') {
      activeProviders = [forcedProvider];
      defaultProvider = forcedProvider;
    } else {
      // Check country mapping
      const countryMatch = setting?.countryPaymentProviders?.find(
        (c: any) => c.countryCode?.toUpperCase() === countryCode && c.isActive !== false
      );

      if (countryCode === 'NG') {
        if (paystackEnabled) activeProviders.push('paystack');
        if (flutterwaveEnabled) activeProviders.push('flutterwave');
        if (activeProviders.length === 0 && stripeEnabled) activeProviders.push('stripe');
        defaultProvider = countryMatch?.provider || (paystackEnabled ? 'paystack' : flutterwaveEnabled ? 'flutterwave' : 'stripe');
      } else {
        if (stripeEnabled) activeProviders.push('stripe');
        if (activeProviders.length === 0) {
          if (paystackEnabled) activeProviders.push('paystack');
          if (flutterwaveEnabled) activeProviders.push('flutterwave');
        }
        defaultProvider = countryMatch?.provider || (stripeEnabled ? 'stripe' : 'paystack');
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        allDisabled,
        forcedProvider,
        activeProviders,
        defaultProvider,
        providers: {
          paystack: paystackEnabled,
          flutterwave: flutterwaveEnabled,
          stripe: stripeEnabled,
        },
      },
    });
  });

  /**
   * Verify Payment by Reference (Paystack or Flutterwave)
   */
  public verifyPayment = catchAsync(async (req: Request, res: Response) => {
    const refStr = Array.isArray(req.params.reference) ? req.params.reference[0] : String(req.params.reference || '');
    const provider = (req.query.provider as PaymentProvider) || 'paystack';

    if (!refStr) {
      throw new AppError('Payment reference is required', 400);
    }

    const verificationResult = await paymentService.verifyPayment(refStr, provider);

    res.status(200).json({
      status: 'success',
      data: verificationResult,
    });
  });

  /**
   * Webhook endpoint for Paystack
   */
  public handlePaystackWebhook = catchAsync(async (req: Request, res: Response) => {
    const signature = req.headers['x-paystack-signature'] as string;
    if (!signature) {
      res.status(400).send('Missing Paystack signature header');
      return;
    }

    const payload = (req as any).rawBody || req.body;
    await paymentService.processPaystackWebhook(payload, signature);

    // Paystack expects a 200 OK response immediately
    res.status(200).send('Paystack webhook received successfully');
  });

  /**
   * Webhook endpoint for Flutterwave
   */
  public handleFlutterwaveWebhook = catchAsync(async (req: Request, res: Response) => {
    const signature = (req.headers['verif-hash'] || req.headers['x-flutterwave-signature']) as string;
    if (!signature) {
      res.status(400).send('Missing Flutterwave verif-hash header');
      return;
    }

    await paymentService.processFlutterwaveWebhook(req.body, signature);

    // Flutterwave expects a 200 OK response immediately
    res.status(200).send('Flutterwave webhook received successfully');
  });

  /**
   * Webhook endpoint for Stripe
   */
  public handleStripeWebhook = catchAsync(async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;
    const rawBody = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    // Cryptographically verify Stripe Webhook Signature if secret configured
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      if (!signature) {
        throw new AppError('Missing Stripe signature header', 400);
      }
      const isValid = stripeModule.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        throw new AppError('Invalid Stripe webhook signature', 400);
      }
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (event?.type === 'checkout.session.completed') {
      const session = event.data?.object;
      const reference = session?.client_reference_id || session?.id;
      if (reference) {
        await paymentService.verifyPayment(reference, 'stripe');
      }
    }

    res.status(200).json({ received: true });
  });

  /**
   * Admin / System: Payout Delivery Rider
   */
  public payoutRider = catchAsync(async (req: Request, res: Response) => {
    const { riderId, amount, provider } = req.body;
    if (!riderId || !amount) {
      throw new AppError('riderId and amount are required', 400);
    }

    const payoutResult = await paymentService.payoutRider(
      riderId,
      Number(amount),
      provider as PaymentProvider
    );

    res.status(200).json({
      status: 'success',
      message: 'Rider payout completed successfully',
      data: payoutResult,
    });
  });

  /**
   * Admin / System: Payout Restaurant Vendor
   */
  public payoutRestaurant = catchAsync(async (req: Request, res: Response) => {
    const { restaurantId, amount, provider } = req.body;
    if (!restaurantId || !amount) {
      throw new AppError('restaurantId and amount are required', 400);
    }

    const payoutResult = await paymentService.payoutRestaurant(
      restaurantId,
      Number(amount),
      provider as PaymentProvider
    );

    res.status(200).json({
      status: 'success',
      message: 'Restaurant payout completed successfully',
      data: payoutResult,
    });
  });

  /**
   * Fetch payments for a vendor's restaurant
   */
  public getVendorPayments = catchAsync(async (req: Request, res: Response) => {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('User does not belong to any restaurant', 403);
    }

    const orders = await Order.find({ restaurant: restaurantId })
      .sort({ createdAt: -1 })
      .select('_id totalAmount paymentStatus paymentResult createdAt paymentMethod');

    res.status(200).json({
      status: 'success',
      results: orders.length,
      data: orders,
    });
  });

  /**
   * Update payment details manually (e.g. status or reference)
   */
  public updatePaymentDetails = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, reference } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      throw new AppError('Payment/Order not found', 404);
    }

    if (status) {
      order.paymentStatus = status;
    }
    if (reference) {
      if (!order.paymentResult) {
        order.paymentResult = { id: reference, status: order.paymentStatus, update_time: new Date().toISOString(), email_address: '' };
      } else {
        order.paymentResult.id = reference;
      }
    }

    await order.save();

    res.status(200).json({
      status: 'success',
      data: order,
    });
  });

  /**
   * Get bank verification configuration based on geo-location or user profile
   */
  public getBankVerificationConfig = catchAsync(async (req: Request, res: Response) => {
    const loc = resolveRequestLocation(req);
    const countryCode = (req.query.countryCode as string) || loc.countryCode;
    const config = await paymentService.getBankVerificationConfig(countryCode, req.user);

    res.status(200).json({
      status: 'success',
      data: config,
    });
  });

  /**
   * Fetch list of supported banks by country / region
   */
  public getBanks = catchAsync(async (req: Request, res: Response) => {
    const loc = resolveRequestLocation(req);
    const countryCode = ((req.query.countryCode as string) || loc.countryCode || 'NG').toUpperCase();

    if (countryCode === 'GB' || countryCode === 'UK') {
      const banks = stripeModule.getBanksByCountry('GB');
      return res.status(200).json({ status: 'success', data: banks });
    } else if (countryCode === 'IT') {
      const banks = stripeModule.getBanksByCountry('IT');
      return res.status(200).json({ status: 'success', data: banks });
    } else if (countryCode === 'US') {
      const banks = stripeModule.getBanksByCountry('US');
      return res.status(200).json({ status: 'success', data: banks });
    }

    const country = (req.query.country as string) || (countryCode === 'GH' ? 'ghana' : 'nigeria');
    const banks = await paystackModule.getBanks(country);

    res.status(200).json({
      status: 'success',
      data: banks,
    });
  });

  /**
   * Resolve and verify bank account details (multi-country: Paystack or Stripe)
   */
  public resolveAccountNumber = catchAsync(async (req: Request, res: Response) => {
    const { accountNumber, bankCode, routingNumber, accountHolderName, sortCode } = req.query;
    if (!accountNumber) {
      throw new AppError('accountNumber query parameter is required', 400);
    }

    const loc = resolveRequestLocation(req);
    const countryCode = (req.query.countryCode as string) || loc.countryCode;

    const result = await paymentService.resolveUnifiedBankAccount({
      accountNumber: String(accountNumber),
      bankCode: bankCode ? String(bankCode) : undefined,
      routingNumber: (routingNumber || sortCode) ? String(routingNumber || sortCode) : undefined,
      accountHolderName: accountHolderName ? String(accountHolderName) : undefined,
      countryCode,
      user: req.user,
    });

    res.status(200).json({
      status: 'success',
      data: result,
    });
  });

  /**
   * Vendor: Setup Bank Details & Paystack Subaccount
   */
  public setupSubaccount = catchAsync(async (req: Request, res: Response) => {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('User does not belong to any restaurant', 403);
    }

    const { bankName, bankCode, accountNumber, accountName } = req.body;
    if (!bankName || !bankCode || !accountNumber || !accountName) {
      throw new AppError('bankName, bankCode, accountNumber, and accountName are required', 400);
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }

    const loc = resolveRequestLocation(req);
    const countryCode = ((req.body.countryCode || loc.countryCode || 'NG') as string).toUpperCase();
    const isForeign = countryCode !== 'NG' && countryCode !== 'GH';

    let subaccountCode: string | undefined = undefined;
    if (!isForeign) {
      try {
        // Default percentage charge is 0, since we will override with transaction_charge per order
        const subRes = await paystackModule.createSubaccount({
          businessName: restaurant.name,
          bankCode: String(bankCode),
          accountNumber: String(accountNumber),
          percentageCharge: 0,
        });
        subaccountCode = subRes.subaccountCode;
      } catch (err: any) {
        logger.warn(`Paystack subaccount creation skipped/fallback: ${err.message}`);
      }
    }

    if (subaccountCode) {
      restaurant.paystackSubaccountCode = subaccountCode;
    }

    restaurant.bankDetails = {
      bankName,
      bankCode: bankCode || req.body.sortCode || (countryCode === 'IT' ? 'IBAN' : 'INTERNATIONAL'),
      accountNumber,
      accountName,
      isVerified: true,
    };

    await restaurant.save();

    res.status(200).json({
      status: 'success',
      message: 'Bank details configured successfully',
      data: {
        paystackSubaccountCode: subaccountCode,
        bankDetails: restaurant.bankDetails,
      },
    });
  });

  /**
   * Universal Payment Callback HTML Page
   * Served when Paystack / Flutterwave / Stripe redirects the WebView after payment.
   */
  public handlePaymentCallback = catchAsync(async (req: Request, res: Response) => {
    const reference = (req.query.reference || req.query.trxref || req.query.tx_ref || req.query.session_id || '') as string;
    const provider = String(req.query.provider || 'paystack');
    const customRedirect = (req.query.redirect_url || req.query.redirectUrl || req.query.return_url || '') as string;

    let orderId = '';
    let isVerified = false;

    // 1. Verify transaction with gateway immediately
    if (reference) {
      try {
        const verifyRes = await paymentService.verifyPayment(reference, provider as any);
        const orderList = verifyRes?.orders || (verifyRes?.order ? [verifyRes.order] : []);
        if (orderList.length > 0) {
          orderId = orderList[0]._id?.toString?.() || '';
          isVerified = true;
        } else {
          isVerified = true;
        }
      } catch (verifyErr: any) {
        logger.warn(`Payment callback auto-verification notice: ${verifyErr.message}`);
        try {
          const matchedOrder = await Order.findOne({
            $or: [
              { 'paymentResult.id': reference },
              { _id: reference.includes('_') ? reference.split('_')[1] : reference },
            ],
          });
          if (matchedOrder) {
            orderId = matchedOrder._id.toString();
            isVerified = matchedOrder.paymentStatus === 'completed';
          }
        } catch {}
      }
    }

    // 2. Resolve target Web App Redirect URL (support https://goeatone.com and https://go-eat-webapp.vercel.app)
    let targetBaseUrl = 'https://goeatone.com';
    const referer = String(req.headers.referer || req.headers.origin || '').toLowerCase();

    if (customRedirect) {
      try {
        const parsed = new URL(customRedirect);
        if (
          parsed.hostname.includes('goeatone.com') ||
          parsed.hostname.includes('vercel.app') ||
          parsed.hostname.includes('localhost')
        ) {
          targetBaseUrl = parsed.origin;
        }
      } catch {
        if (customRedirect.startsWith('http://') || customRedirect.startsWith('https://')) {
          targetBaseUrl = customRedirect.replace(/\/$/, '');
        }
      }
    } else if (referer.includes('vercel.app')) {
      targetBaseUrl = 'https://go-eat-webapp.vercel.app';
    } else if (referer.includes('goeatone.com')) {
      targetBaseUrl = 'https://goeatone.com';
    } else if (referer.includes('localhost')) {
      targetBaseUrl = 'http://localhost:3000';
    }

    const cleanBase = targetBaseUrl.replace(/\/$/, '');
    const queryParams = `status=success&reference=${encodeURIComponent(reference)}${
      orderId ? `&orderId=${encodeURIComponent(orderId)}` : ''
    }&provider=${encodeURIComponent(provider)}`;

    const targetRedirectUrl = `${cleanBase}/checkout?${queryParams}`;
    const vercelRedirectUrl = `https://go-eat-webapp.vercel.app/checkout?${queryParams}`;
    const goeatoneRedirectUrl = `https://goeatone.com/checkout?${queryParams}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta http-equiv="refresh" content="2;url=${targetRedirectUrl}">
  <title>Payment Completed - Go-Eat</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0B291B;
      color: #FFFFFF;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .card {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 28px;
      padding: 40px 28px;
      width: 100%;
      max-width: 420px;
      backdrop-filter: blur(14px);
      box-shadow: 0 24px 48px rgba(0,0,0,0.35);
    }
    .icon-badge {
      width: 68px;
      height: 68px;
      border-radius: 34px;
      background: #10B981;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 34px;
      margin-bottom: 20px;
      box-shadow: 0 10px 24px rgba(16, 185, 129, 0.35);
    }
    h1 {
      font-size: 24px;
      margin: 0 0 10px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    p {
      margin: 0 0 18px;
      font-size: 14px;
      color: #D1D5DB;
      line-height: 1.55;
    }
    .ref-chip {
      display: inline-block;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.12);
      padding: 7px 16px;
      border-radius: 12px;
      font-family: monospace;
      font-size: 11px;
      color: #34D399;
      margin-bottom: 24px;
      word-break: break-all;
    }
    .progress-bar-container {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.12);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 22px;
    }
    .progress-bar {
      width: 100%;
      height: 100%;
      background: #10B981;
      animation: fillProgress 1.6s ease-in-out infinite;
    }
    @keyframes fillProgress {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    .btn-return {
      display: block;
      width: 100%;
      background: #10B981;
      color: #FFFFFF;
      font-weight: 700;
      font-size: 14px;
      padding: 14px 20px;
      border-radius: 16px;
      text-decoration: none;
      transition: background 0.2s, transform 0.1s;
      margin-bottom: 14px;
    }
    .btn-return:hover {
      background: #059669;
    }
    .btn-return:active {
      transform: scale(0.98);
    }
    .alt-links {
      font-size: 11px;
      color: #9CA3AF;
      margin-top: 10px;
    }
    .alt-links a {
      color: #34D399;
      text-decoration: none;
      font-weight: 600;
      margin: 0 4px;
    }
    .alt-links a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-badge">✓</div>
    <h1>Payment Completed</h1>
    <p>Your payment has been successfully processed by ${provider.toUpperCase()}. Redirecting you back to Go-Eat to confirm your order...</p>
    
    ${reference ? `<div class="ref-chip">Ref: ${reference}</div>` : ''}

    <div class="progress-bar-container">
      <div class="progress-bar"></div>
    </div>

    <a href="${targetRedirectUrl}" class="btn-return">
      Return to Go-Eat Web App →
    </a>

    <div class="alt-links">
      <span>Alternative Web Links:</span><br>
      <a href="${goeatoneRedirectUrl}">goeatone.com</a> |
      <a href="${vercelRedirectUrl}">go-eat-webapp.vercel.app</a>
    </div>
  </div>

  <script>
    // Automatic redirection
    const redirectUrl = "${targetRedirectUrl}";
    const orderId = "${orderId}";

    // Deep link attempt for mobile app webviews
    if (orderId && /mobile|android|iphone/i.test(navigator.userAgent)) {
      try {
        window.location.href = "goeat://order-tracking/" + orderId;
      } catch (e) {}
    }

    // Web browser redirection
    setTimeout(function() {
      window.location.replace(redirectUrl);
    }, 1200);
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  });
}

export default new PaymentController();
