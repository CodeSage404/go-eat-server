"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const payment_service_1 = __importDefault(require("../services/payment.service"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
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
    }
}
exports.default = new PaymentController();
