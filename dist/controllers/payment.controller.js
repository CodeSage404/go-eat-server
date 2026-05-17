"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const payment_service_1 = __importDefault(require("../services/payment.service"));
const catchAsync_1 = require("../utils/catchAsync");
class PaymentController {
    constructor() {
        /**
         * Initialize a new Paystack payment
         */
        this.initializePayment = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { orderId } = req.body;
            // We expect the customer to be the one requesting the payment link
            const paymentData = await payment_service_1.default.initializePayment(orderId, req.user._id.toString());
            res.status(200).json({
                status: 'success',
                data: {
                    authorizationUrl: paymentData.authorization_url,
                    accessCode: paymentData.access_code,
                    reference: paymentData.reference,
                },
            });
        });
        /**
         * Webhook endpoint for Paystack to hit
         */
        this.handleWebhook = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const signature = req.headers['x-paystack-signature'];
            if (!signature) {
                res.status(400).send('Missing signature');
                return;
            }
            // Process the webhook in the service
            await payment_service_1.default.processWebhook(req.body, signature);
            // Paystack expects a 200 OK response immediately
            res.status(200).send('Webhook received successfully');
        });
    }
}
exports.default = new PaymentController();
