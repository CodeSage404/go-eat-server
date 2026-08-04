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
exports.PaymentService = void 0;
const order_model_1 = __importStar(require("../models/order.model"));
const user_model_1 = __importStar(require("../models/user.model"));
const wallet_model_1 = __importDefault(require("../models/wallet.model"));
const appError_1 = __importDefault(require("../utils/appError"));
const logger_1 = __importDefault(require("../utils/logger"));
const notification_service_1 = __importDefault(require("./notification.service"));
const paystack_module_1 = __importDefault(require("./payments/paystack.module"));
const flutterwave_module_1 = __importDefault(require("./payments/flutterwave.module"));
const setting_model_1 = __importDefault(require("../models/setting.model"));
class PaymentService {
    /**
     * Initialize Payment for an Order using preferred provider (Paystack or Flutterwave)
     */
    async initializePayment(orderId, userId, provider, callbackUrl) {
        const order = await order_model_1.default.findById(orderId);
        if (!order)
            throw new appError_1.default('Order not found', 404);
        if (order.customer.toString() !== userId) {
            throw new appError_1.default('Unauthorized access to this order', 403);
        }
        if (order.status !== order_model_1.OrderStatus.PENDING) {
            throw new appError_1.default('This order cannot be paid for in its current state', 400);
        }
        const user = await user_model_1.default.findById(userId);
        if (!user)
            throw new appError_1.default('User not found', 404);
        const setting = await setting_model_1.default.findOne();
        const activeProvider = (provider || setting?.defaultPaymentProvider || process.env.DEFAULT_PAYMENT_PROVIDER || 'paystack');
        const reference = `ORD_${order._id}_${Date.now()}`;
        const amount = order.totalAmount;
        if (activeProvider.toLowerCase() === 'flutterwave') {
            const result = await flutterwave_module_1.default.initializePayment({
                email: user.email,
                amount,
                reference,
                customerName: user.name,
                customerPhone: user.phoneNumber,
                redirectUrl: callbackUrl || `${process.env.APP_URL || 'https://api.goeatalone.com'}/payment/callback?reference=${reference}&provider=flutterwave`,
                metadata: {
                    orderId: order._id.toString(),
                    customerId: user._id.toString(),
                },
            });
            return {
                authorizationUrl: result.authorizationUrl,
                reference: result.reference,
                provider: 'flutterwave',
            };
        }
        else {
            // Default: Paystack
            const result = await paystack_module_1.default.initializePayment({
                email: user.email,
                amount,
                reference,
                callbackUrl: callbackUrl || `${process.env.APP_URL || 'https://api.goeatalone.com'}/payment/callback?reference=${reference}&provider=paystack`,
                metadata: {
                    orderId: order._id.toString(),
                    customerId: user._id.toString(),
                },
            });
            return {
                authorizationUrl: result.authorizationUrl,
                accessCode: result.accessCode,
                reference: result.reference,
                provider: 'paystack',
            };
        }
    }
    /**
     * Verify Payment Status from either Paystack or Flutterwave
     */
    async verifyPayment(reference, provider = 'paystack') {
        let orderId;
        let paymentResult;
        if (provider.toLowerCase() === 'flutterwave') {
            const data = await flutterwave_module_1.default.verifyPayment(reference);
            if (data.status !== 'successful') {
                throw new appError_1.default('Flutterwave payment was not successful', 400);
            }
            orderId = data.meta?.orderId || reference.split('_')[1];
            paymentResult = {
                id: data.id ? String(data.id) : reference,
                status: 'success',
                update_time: new Date().toISOString(),
                email_address: data.customer?.email,
                provider: 'flutterwave',
            };
        }
        else {
            const data = await paystack_module_1.default.verifyPayment(reference);
            if (data.status !== 'success') {
                throw new appError_1.default('Paystack payment was not successful', 400);
            }
            orderId = data.metadata?.orderId || reference.split('_')[1];
            paymentResult = {
                id: data.id ? String(data.id) : reference,
                status: 'success',
                update_time: new Date().toISOString(),
                email_address: data.customer?.email,
                provider: 'paystack',
            };
        }
        if (!orderId) {
            throw new appError_1.default('Could not identify associated order from payment reference', 400);
        }
        const order = await order_model_1.default.findById(orderId);
        if (!order) {
            throw new appError_1.default('Order associated with payment not found', 404);
        }
        if (order.status === order_model_1.OrderStatus.PENDING) {
            order.status = order_model_1.OrderStatus.ACCEPTED;
            order.paymentResult = paymentResult;
            await order.save();
            // Send notifications
            try {
                await notification_service_1.default.notifyNewOrder(order.restaurant.toString(), order._id.toString());
                await notification_service_1.default.notifyOrderStatusUpdate(order.customer.toString(), order._id.toString(), order.status);
            }
            catch (notifyErr) {
                logger_1.default.warn('Failed to send order notifications:', notifyErr.message);
            }
        }
        return {
            orderId: order._id,
            status: order.status,
            paymentResult: order.paymentResult,
        };
    }
    /**
     * Secure Webhook Handler for Paystack
     */
    async processPaystackWebhook(event, signature) {
        const isValid = paystack_module_1.default.verifyWebhookSignature(event, signature);
        if (!isValid) {
            throw new appError_1.default('Invalid Paystack webhook signature', 400);
        }
        if (event.event === 'charge.success') {
            const reference = event.data?.reference;
            if (reference) {
                await this.verifyPayment(reference, 'paystack');
            }
        }
    }
    /**
     * Secure Webhook Handler for Flutterwave
     */
    async processFlutterwaveWebhook(payload, signatureHeader) {
        const isValid = flutterwave_module_1.default.verifyWebhookSignature(signatureHeader);
        if (!isValid) {
            throw new appError_1.default('Invalid Flutterwave webhook signature', 400);
        }
        if (payload.event === 'charge.completed' && payload.data?.status === 'successful') {
            const reference = payload.data?.tx_ref;
            if (reference) {
                await this.verifyPayment(reference, 'flutterwave');
            }
        }
    }
    /**
     * Payout / Transfer money to a Delivery Rider's Bank Account
     */
    async payoutRider(riderId, amount, provider = process.env.DEFAULT_PAYMENT_PROVIDER || 'paystack') {
        if (amount <= 0)
            throw new appError_1.default('Payout amount must be greater than zero', 400);
        const rider = await user_model_1.default.findById(riderId);
        if (!rider || rider.role !== user_model_1.UserRole.RIDER) {
            throw new appError_1.default('Delivery rider not found', 404);
        }
        const wallet = await wallet_model_1.default.findOne({ user: riderId });
        if (!wallet) {
            throw new appError_1.default('Rider wallet not found', 404);
        }
        if (wallet.balance < amount) {
            throw new appError_1.default(`Insufficient wallet balance. Current balance: NGN ${wallet.balance}`, 400);
        }
        const bankAccount = wallet.bankAccount;
        if (!bankAccount || !bankAccount.accountNumber || !bankAccount.bankCode) {
            throw new appError_1.default('Rider has not configured valid bank account details for payout', 400);
        }
        const reference = `PAYOUT_RIDER_${riderId}_${Date.now()}`;
        let transferResult;
        if (provider.toLowerCase() === 'flutterwave') {
            transferResult = await flutterwave_module_1.default.initiatePayout({
                amount,
                accountNumber: bankAccount.accountNumber,
                bankCode: bankAccount.bankCode,
                reference,
                narration: `Go-Eat Rider Payout (${rider.name})`,
                beneficiaryName: bankAccount.accountName || rider.name,
            });
        }
        else {
            let recipientCode = bankAccount.recipientCode;
            if (!recipientCode) {
                const recipient = await paystack_module_1.default.createTransferRecipient({
                    name: bankAccount.accountName || rider.name,
                    accountNumber: bankAccount.accountNumber,
                    bankCode: bankAccount.bankCode,
                });
                recipientCode = recipient.recipientCode;
                wallet.bankAccount.recipientCode = recipientCode;
                await wallet.save();
            }
            transferResult = await paystack_module_1.default.initiatePayout({
                amount,
                recipientCode,
                reference,
                reason: `Go-Eat Rider Payout (${rider.name})`,
            });
        }
        // Deduct amount from wallet balance after transfer initiation
        wallet.balance -= amount;
        wallet.lastPayoutDate = new Date();
        await wallet.save();
        logger_1.default.info(`✅ Successful payout of NGN ${amount} to rider ${rider.name} (${riderId}) via ${provider}`);
        return {
            reference,
            provider,
            amount,
            newBalance: wallet.balance,
            transferDetails: transferResult,
        };
    }
    /**
     * Payout / Transfer money to a Restaurant Vendor's Bank Account
     */
    async payoutRestaurant(restaurantId, amount, provider = process.env.DEFAULT_PAYMENT_PROVIDER || 'paystack') {
        if (amount <= 0)
            throw new appError_1.default('Payout amount must be greater than zero', 400);
        const wallet = await wallet_model_1.default.findOne({ user: restaurantId });
        if (!wallet) {
            throw new appError_1.default('Restaurant wallet not found', 404);
        }
        if (wallet.balance < amount) {
            throw new appError_1.default(`Insufficient wallet balance. Current balance: NGN ${wallet.balance}`, 400);
        }
        const bankAccount = wallet.bankAccount;
        if (!bankAccount || !bankAccount.accountNumber || !bankAccount.bankCode) {
            throw new appError_1.default('Restaurant has not configured valid bank account details for payout', 400);
        }
        const reference = `PAYOUT_REST_${restaurantId}_${Date.now()}`;
        let transferResult;
        if (provider.toLowerCase() === 'flutterwave') {
            transferResult = await flutterwave_module_1.default.initiatePayout({
                amount,
                accountNumber: bankAccount.accountNumber,
                bankCode: bankAccount.bankCode,
                reference,
                narration: 'Go-Eat Restaurant Payout',
                beneficiaryName: bankAccount.accountName || 'Go-Eat Vendor',
            });
        }
        else {
            let recipientCode = bankAccount.recipientCode;
            if (!recipientCode) {
                const recipient = await paystack_module_1.default.createTransferRecipient({
                    name: bankAccount.accountName || 'Go-Eat Vendor',
                    accountNumber: bankAccount.accountNumber,
                    bankCode: bankAccount.bankCode,
                });
                recipientCode = recipient.recipientCode;
                wallet.bankAccount.recipientCode = recipientCode;
                await wallet.save();
            }
            transferResult = await paystack_module_1.default.initiatePayout({
                amount,
                recipientCode,
                reference,
                reason: 'Go-Eat Restaurant Payout',
            });
        }
        wallet.balance -= amount;
        wallet.lastPayoutDate = new Date();
        await wallet.save();
        logger_1.default.info(`✅ Successful payout of NGN ${amount} to restaurant vendor (${restaurantId}) via ${provider}`);
        return {
            reference,
            provider,
            amount,
            newBalance: wallet.balance,
            transferDetails: transferResult,
        };
    }
}
exports.PaymentService = PaymentService;
exports.default = new PaymentService();
