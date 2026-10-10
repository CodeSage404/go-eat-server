"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const payment_service_1 = __importDefault(require("../services/payment.service"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const order_model_1 = __importDefault(require("../models/order.model"));
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
const setting_model_1 = __importDefault(require("../models/setting.model"));
const paystack_module_1 = __importDefault(require("../services/payments/paystack.module"));
const stripe_module_1 = __importDefault(require("../services/payments/stripe.module"));
const locationResolver_1 = require("../utils/locationResolver");
const logger_1 = __importDefault(require("../utils/logger"));
class PaymentController {
    constructor() {
        /**
         * Initialize a new Payment (Paystack or Flutterwave)
         */
        this.initializePayment = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { orderId, provider, callbackUrl } = req.body;
            if (!orderId) {
                throw new appError_1.default('orderId is required', 400);
            }
            const paymentData = await payment_service_1.default.initializePayment(orderId, req.user._id.toString(), provider, callbackUrl);
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
        this.getActivePaymentProviders = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const countryCode = String(req.query.countryCode || '').toUpperCase();
            const setting = await setting_model_1.default.findOne();
            const paystackEnabled = setting?.enablePaystack !== false;
            const flutterwaveEnabled = setting?.enableFlutterwave !== false;
            const stripeEnabled = setting?.enableStripe !== false;
            const allDisabled = !paystackEnabled && !flutterwaveEnabled && !stripeEnabled;
            let forcedProvider = setting?.forceGlobalPaymentProvider || 'none';
            if (forcedProvider !== 'none') {
                if (forcedProvider === 'stripe' && !stripeEnabled)
                    forcedProvider = 'none';
                if (forcedProvider === 'paystack' && !paystackEnabled)
                    forcedProvider = 'none';
                if (forcedProvider === 'flutterwave' && !flutterwaveEnabled)
                    forcedProvider = 'none';
            }
            let activeProviders = [];
            let defaultProvider = 'stripe';
            if (forcedProvider !== 'none') {
                activeProviders = [forcedProvider];
                defaultProvider = forcedProvider;
            }
            else {
                // Check country mapping
                const countryMatch = setting?.countryPaymentProviders?.find((c) => c.countryCode?.toUpperCase() === countryCode && c.isActive !== false);
                if (countryCode === 'NG') {
                    if (paystackEnabled)
                        activeProviders.push('paystack');
                    if (flutterwaveEnabled)
                        activeProviders.push('flutterwave');
                    if (activeProviders.length === 0 && stripeEnabled)
                        activeProviders.push('stripe');
                    defaultProvider = countryMatch?.provider || (paystackEnabled ? 'paystack' : flutterwaveEnabled ? 'flutterwave' : 'stripe');
                }
                else {
                    if (stripeEnabled)
                        activeProviders.push('stripe');
                    if (activeProviders.length === 0) {
                        if (paystackEnabled)
                            activeProviders.push('paystack');
                        if (flutterwaveEnabled)
                            activeProviders.push('flutterwave');
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
        this.verifyPayment = (0, catchAsync_1.catchAsync)(async (req, res) => {
            let rawRef = Array.isArray(req.params.reference) ? req.params.reference[0] : String(req.params.reference || '');
            if (rawRef.includes(',')) {
                rawRef = rawRef.split(',')[0].trim();
            }
            const refStr = rawRef.trim();
            const provider = req.query.provider || 'paystack';
            if (!refStr) {
                throw new appError_1.default('Payment reference is required', 400);
            }
            const verificationResult = await payment_service_1.default.verifyPayment(refStr, provider);
            res.status(200).json({
                status: 'success',
                data: verificationResult,
            });
        });
        /**
         * Webhook endpoint for Paystack
         */
        this.handlePaystackWebhook = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const signature = req.headers['x-paystack-signature'];
            if (!signature) {
                res.status(400).send('Missing Paystack signature header');
                return;
            }
            const payload = req.rawBody || req.body;
            await payment_service_1.default.processPaystackWebhook(payload, signature);
            // Paystack expects a 200 OK response immediately
            res.status(200).send('Paystack webhook received successfully');
        });
        /**
         * Webhook endpoint for Flutterwave
         */
        this.handleFlutterwaveWebhook = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const signature = (req.headers['verif-hash'] || req.headers['x-flutterwave-signature']);
            if (!signature) {
                res.status(400).send('Missing Flutterwave verif-hash header');
                return;
            }
            await payment_service_1.default.processFlutterwaveWebhook(req.body, signature);
            // Flutterwave expects a 200 OK response immediately
            res.status(200).send('Flutterwave webhook received successfully');
        });
        /**
         * Webhook endpoint for Stripe
         */
        this.handleStripeWebhook = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const signature = req.headers['stripe-signature'];
            const rawBody = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
            // Cryptographically verify Stripe Webhook Signature if secret configured
            if (process.env.STRIPE_WEBHOOK_SECRET) {
                if (!signature) {
                    throw new appError_1.default('Missing Stripe signature header', 400);
                }
                const isValid = stripe_module_1.default.verifyWebhookSignature(rawBody, signature);
                if (!isValid) {
                    throw new appError_1.default('Invalid Stripe webhook signature', 400);
                }
            }
            const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            if (event?.type === 'checkout.session.completed') {
                const session = event.data?.object;
                const reference = session?.client_reference_id || session?.id;
                if (reference) {
                    await payment_service_1.default.verifyPayment(reference, 'stripe');
                }
            }
            res.status(200).json({ received: true });
        });
        /**
         * Admin / System: Payout Delivery Rider
         */
        this.payoutRider = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { riderId, amount, provider } = req.body;
            if (!riderId || !amount) {
                throw new appError_1.default('riderId and amount are required', 400);
            }
            const payoutResult = await payment_service_1.default.payoutRider(riderId, Number(amount), provider);
            res.status(200).json({
                status: 'success',
                message: 'Rider payout completed successfully',
                data: payoutResult,
            });
        });
        /**
         * Admin / System: Payout Restaurant Vendor
         */
        this.payoutRestaurant = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { restaurantId, amount, provider } = req.body;
            if (!restaurantId || !amount) {
                throw new appError_1.default('restaurantId and amount are required', 400);
            }
            const payoutResult = await payment_service_1.default.payoutRestaurant(restaurantId, Number(amount), provider);
            res.status(200).json({
                status: 'success',
                message: 'Restaurant payout completed successfully',
                data: payoutResult,
            });
        });
        /**
         * Fetch payments for a vendor's restaurant
         */
        this.getVendorPayments = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const restaurantId = req.user?.restaurantId;
            if (!restaurantId) {
                throw new appError_1.default('User does not belong to any restaurant', 403);
            }
            const orders = await order_model_1.default.find({ restaurant: restaurantId })
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
        this.updatePaymentDetails = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const { status, reference } = req.body;
            const order = await order_model_1.default.findById(id);
            if (!order) {
                throw new appError_1.default('Payment/Order not found', 404);
            }
            if (status) {
                order.paymentStatus = status;
            }
            if (reference) {
                if (!order.paymentResult) {
                    order.paymentResult = { id: reference, status: order.paymentStatus, update_time: new Date().toISOString(), email_address: '' };
                }
                else {
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
        this.getBankVerificationConfig = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const loc = (0, locationResolver_1.resolveRequestLocation)(req);
            const countryCode = req.query.countryCode || loc.countryCode;
            const config = await payment_service_1.default.getBankVerificationConfig(countryCode, req.user);
            res.status(200).json({
                status: 'success',
                data: config,
            });
        });
        /**
         * Fetch list of supported banks by country / region
         */
        this.getBanks = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const loc = (0, locationResolver_1.resolveRequestLocation)(req);
            const countryCode = (req.query.countryCode || loc.countryCode || 'NG').toUpperCase();
            if (countryCode === 'GB' || countryCode === 'UK') {
                const banks = stripe_module_1.default.getBanksByCountry('GB');
                return res.status(200).json({ status: 'success', data: banks });
            }
            else if (countryCode === 'IT') {
                const banks = stripe_module_1.default.getBanksByCountry('IT');
                return res.status(200).json({ status: 'success', data: banks });
            }
            else if (countryCode === 'US') {
                const banks = stripe_module_1.default.getBanksByCountry('US');
                return res.status(200).json({ status: 'success', data: banks });
            }
            const country = req.query.country || (countryCode === 'GH' ? 'ghana' : 'nigeria');
            const banks = await paystack_module_1.default.getBanks(country);
            res.status(200).json({
                status: 'success',
                data: banks,
            });
        });
        /**
         * Resolve and verify bank account details (multi-country: Paystack or Stripe)
         */
        this.resolveAccountNumber = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { accountNumber, bankCode, routingNumber, accountHolderName, sortCode } = req.query;
            if (!accountNumber) {
                throw new appError_1.default('accountNumber query parameter is required', 400);
            }
            const loc = (0, locationResolver_1.resolveRequestLocation)(req);
            const countryCode = req.query.countryCode || loc.countryCode;
            const result = await payment_service_1.default.resolveUnifiedBankAccount({
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
        this.setupSubaccount = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const restaurantId = req.user?.restaurantId;
            if (!restaurantId) {
                throw new appError_1.default('User does not belong to any restaurant', 403);
            }
            const { bankName, bankCode, accountNumber, accountName } = req.body;
            if (!bankName || !bankCode || !accountNumber || !accountName) {
                throw new appError_1.default('bankName, bankCode, accountNumber, and accountName are required', 400);
            }
            const restaurant = await restaurant_model_1.default.findById(restaurantId);
            if (!restaurant) {
                throw new appError_1.default('Restaurant not found', 404);
            }
            const loc = (0, locationResolver_1.resolveRequestLocation)(req);
            const countryCode = (req.body.countryCode || loc.countryCode || 'NG').toUpperCase();
            const isForeign = countryCode !== 'NG' && countryCode !== 'GH';
            let subaccountCode = undefined;
            if (!isForeign) {
                try {
                    // Default percentage charge is 0, since we will override with transaction_charge per order
                    const subRes = await paystack_module_1.default.createSubaccount({
                        businessName: restaurant.name,
                        bankCode: String(bankCode),
                        accountNumber: String(accountNumber),
                        percentageCharge: 0,
                    });
                    subaccountCode = subRes.subaccountCode;
                }
                catch (err) {
                    logger_1.default.warn(`Paystack subaccount creation skipped/fallback: ${err.message}`);
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
        this.handlePaymentCallback = (0, catchAsync_1.catchAsync)(async (req, res) => {
            let rawRef = (req.query.reference || req.query.trxref || req.query.tx_ref || req.query.session_id || '');
            if (Array.isArray(rawRef))
                rawRef = rawRef[0];
            const refStr = String(rawRef || '').trim();
            const reference = refStr.includes(',') ? refStr.split(',')[0].trim() : refStr;
            const provider = String(req.query.provider || 'paystack');
            const customRedirect = (req.query.redirect_url || req.query.redirectUrl || req.query.return_url || '');
            let orderId = '';
            let isVerified = false;
            // 1. Verify transaction with gateway immediately
            if (reference) {
                try {
                    const verifyRes = await payment_service_1.default.verifyPayment(reference, provider);
                    const orderList = verifyRes?.orders || (verifyRes?.order ? [verifyRes.order] : []);
                    if (orderList.length > 0) {
                        orderId = orderList[0]._id?.toString?.() || '';
                        isVerified = true;
                    }
                    else {
                        isVerified = true;
                    }
                }
                catch (verifyErr) {
                    logger_1.default.warn(`Payment callback auto-verification notice: ${verifyErr.message}`);
                    try {
                        const matchedOrder = await order_model_1.default.findOne({
                            $or: [
                                { 'paymentResult.id': reference },
                                { _id: reference.includes('_') ? reference.split('_')[1] : reference },
                            ],
                        });
                        if (matchedOrder) {
                            orderId = matchedOrder._id.toString();
                            isVerified = matchedOrder.paymentStatus === 'completed';
                        }
                    }
                    catch { }
                }
            }
            if (orderId && orderId.includes(',')) {
                orderId = orderId.split(',')[0].trim();
            }
            // 2. Resolve target Web App Redirect URL (support https://goeatone.com and https://go-eat-webapp.vercel.app)
            let targetBaseUrl = 'https://goeatone.com';
            const referer = String(req.headers.referer || req.headers.origin || '').toLowerCase();
            if (customRedirect) {
                try {
                    const parsed = new URL(customRedirect);
                    if (parsed.hostname.includes('goeatone.com') ||
                        parsed.hostname.includes('vercel.app') ||
                        parsed.hostname.includes('localhost')) {
                        targetBaseUrl = parsed.origin;
                    }
                }
                catch {
                    if (customRedirect.startsWith('http://') || customRedirect.startsWith('https://')) {
                        targetBaseUrl = customRedirect.replace(/\/$/, '');
                    }
                }
            }
            else if (referer.includes('vercel.app')) {
                targetBaseUrl = 'https://go-eat-webapp.vercel.app';
            }
            else if (referer.includes('goeatone.com')) {
                targetBaseUrl = 'https://goeatone.com';
            }
            else if (referer.includes('localhost')) {
                targetBaseUrl = 'http://localhost:3000';
            }
            const cleanBase = targetBaseUrl.replace(/\/$/, '');
            const queryParams = `status=success&reference=${encodeURIComponent(reference)}${orderId ? `&orderId=${encodeURIComponent(orderId)}` : ''}&provider=${encodeURIComponent(provider)}`;
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
      background: #FDFCF9;
      color: #111827;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .card {
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 28px;
      padding: 44px 32px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.07);
    }
    .icon-badge {
      width: 68px;
      height: 68px;
      border-radius: 34px;
      background: #ECFDF5;
      border: 2px solid #A7F3D0;
      color: #059669;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: 800;
      margin-bottom: 20px;
      box-shadow: 0 8px 20px rgba(16, 185, 129, 0.15);
    }
    h1 {
      font-size: 22px;
      margin: 0 0 10px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #111827;
    }
    p {
      margin: 0 0 18px;
      font-size: 14px;
      color: #4B5563;
      line-height: 1.55;
    }
    .ref-chip {
      display: inline-block;
      background: #F3F4F6;
      border: 1px solid #E5E7EB;
      padding: 7px 16px;
      border-radius: 12px;
      font-family: monospace;
      font-size: 12px;
      color: #0F7644;
      font-weight: 700;
      margin-bottom: 24px;
      word-break: break-all;
    }
    .progress-bar-container {
      width: 100%;
      height: 5px;
      background: #E5E7EB;
      border-radius: 999px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    .progress-bar {
      width: 100%;
      height: 100%;
      background: #0F7644;
      border-radius: 999px;
      animation: fillProgress 1.5s ease-in-out infinite;
    }
    @keyframes fillProgress {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    .btn-return {
      display: block;
      width: 100%;
      background: #0F7644;
      color: #FFFFFF;
      font-weight: 700;
      font-size: 14px;
      padding: 14px 20px;
      border-radius: 16px;
      text-decoration: none;
      transition: background 0.2s, transform 0.1s;
      margin-bottom: 16px;
      box-shadow: 0 4px 14px rgba(15, 118, 68, 0.25);
    }
    .btn-return:hover {
      background: #0B5B34;
    }
    .btn-return:active {
      transform: scale(0.98);
    }
    .alt-links {
      font-size: 12px;
      color: #6B7280;
      margin-top: 10px;
    }
    .alt-links a {
      color: #0F7644;
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
}
exports.default = new PaymentController();
