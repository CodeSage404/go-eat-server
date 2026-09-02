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
const paystack_module_1 = __importDefault(require("../services/payments/paystack.module"));
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
         * Verify Payment by Reference (Paystack or Flutterwave)
         */
        this.verifyPayment = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const refStr = Array.isArray(req.params.reference) ? req.params.reference[0] : String(req.params.reference || '');
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
            await payment_service_1.default.processPaystackWebhook(req.body, signature);
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
         * Fetch list of supported banks from Paystack
         */
        this.getBanks = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const country = req.query.country || 'nigeria';
            const banks = await paystack_module_1.default.getBanks(country);
            res.status(200).json({
                status: 'success',
                data: banks,
            });
        });
        /**
         * Resolve and verify Nigerian bank account number
         */
        this.resolveAccountNumber = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { accountNumber, bankCode } = req.query;
            if (!accountNumber || !bankCode) {
                throw new appError_1.default('accountNumber and bankCode query parameters are required', 400);
            }
            const result = await paystack_module_1.default.resolveAccountNumber(String(accountNumber), String(bankCode));
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
            // Default percentage charge is 0, since we will override with transaction_charge per order
            const { subaccountCode } = await paystack_module_1.default.createSubaccount({
                businessName: restaurant.name,
                bankCode,
                accountNumber,
                percentageCharge: 0,
            });
            restaurant.paystackSubaccountCode = subaccountCode;
            restaurant.bankDetails = {
                bankName,
                bankCode,
                accountNumber,
                accountName,
                isVerified: true,
            };
            await restaurant.save();
            res.status(200).json({
                status: 'success',
                message: 'Bank details and subaccount configured successfully',
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
            const reference = (req.query.reference || req.query.trxref || req.query.tx_ref || '');
            const provider = String(req.query.provider || 'paystack');
            const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
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
      border-radius: 24px;
      padding: 36px 24px;
      width: 100%;
      max-width: 360px;
      backdrop-filter: blur(12px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    }
    .icon-badge {
      width: 64px;
      height: 64px;
      border-radius: 32px;
      background: #10B981;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      margin-bottom: 20px;
      box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3);
    }
    h1 {
      font-size: 22px;
      margin: 0 0 10px;
      font-weight: 700;
    }
    p {
      margin: 0 0 16px;
      font-size: 14px;
      color: #D1D5DB;
      line-height: 1.5;
    }
    .ref-chip {
      display: inline-block;
      background: rgba(0,0,0,0.25);
      border: 1px solid rgba(255,255,255,0.1);
      padding: 6px 14px;
      border-radius: 12px;
      font-family: monospace;
      font-size: 12px;
      color: #34D399;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-badge">✓</div>
    <h1>Payment Completed</h1>
    <p>Your transaction has been processed by ${provider.toUpperCase()}. Returning you to Go-Eat to view your order...</p>
    ${reference ? `<div class="ref-chip">Ref: ${reference}</div>` : ''}
  </div>
</body>
</html>`;
            res.setHeader('Content-Type', 'text/html');
            res.status(200).send(html);
        });
    }
}
exports.default = new PaymentController();
