"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const appError_1 = __importDefault(require("../utils/appError"));
const order_model_1 = __importStar(require("../models/order.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const notification_service_1 = __importDefault(require("./notification.service"));
class PaymentService {
    constructor() {
        this.secretKey = process.env.PAYSTACK_SECRET_KEY || 'sk_test_placeholder';
        this.baseUrl = 'https://api.paystack.co';
    }
    /**
     * Initialize a Paystack transaction for an order
     */
    async initializePayment(orderId, userId) {
        const order = await order_model_1.default.findById(orderId);
        if (!order)
            throw new appError_1.default('Order not found', 404);
        if (order.customer.toString() !== userId) {
            throw new appError_1.default('Unauthorized', 403);
        }
        if (order.status !== order_model_1.OrderStatus.PENDING) {
            throw new appError_1.default('This order cannot be paid for in its current state', 400);
        }
        const user = await user_model_1.default.findById(userId);
        if (!user)
            throw new appError_1.default('User not found', 404);
        // Paystack amounts are in kobo (multiply by 100)
        const amountInKobo = Math.round(order.totalAmount * 100);
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/transaction/initialize`, {
                email: user.email,
                amount: amountInKobo,
                reference: `ORD_${order._id}_${Date.now()}`,
                metadata: {
                    orderId: order._id,
                    customerId: user._id,
                },
                // callback_url: 'https://yourfrontend.com/payment/verify' // Will be added later
            }, {
                headers: {
                    Authorization: `Bearer ${this.secretKey}`,
                    'Content-Type': 'application/json',
                },
            });
            return response.data.data;
        }
        catch (error) {
            console.error('Paystack initialization error:', error.response?.data || error.message);
            throw new appError_1.default('Payment initialization failed', 500);
        }
    }
    /**
     * Process incoming Paystack Webhook
     */
    async processWebhook(event, signature) {
        // Verify Signature
        const hash = crypto_1.default
            .createHmac('sha512', this.secretKey)
            .update(JSON.stringify(event))
            .digest('hex');
        if (hash !== signature) {
            throw new appError_1.default('Invalid webhook signature', 400);
        }
        // Handle successful payment event
        if (event.event === 'charge.success') {
            const { reference, metadata } = event.data;
            const orderId = metadata.orderId;
            const order = await order_model_1.default.findById(orderId);
            if (order && order.status === order_model_1.OrderStatus.PENDING) {
                // Mark order as accepted (payment verified)
                order.status = order_model_1.OrderStatus.ACCEPTED;
                order.paymentResult = {
                    id: event.data.id.toString(),
                    status: 'success',
                    update_time: new Date().toISOString(),
                    email_address: event.data.customer.email,
                };
                await order.save();
                // Notify Restaurant and Customer
                await notification_service_1.default.notifyNewOrder(order.restaurant.toString(), order._id.toString());
                await notification_service_1.default.notifyOrderStatusUpdate(order.customer.toString(), order._id.toString(), order.status);
            }
        }
    }
}
exports.default = new PaymentService();
