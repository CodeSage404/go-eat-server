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
const order_model_1 = __importDefault(require("../models/order.model"));
const user_model_1 = __importStar(require("../models/user.model"));
const wallet_model_1 = __importDefault(require("../models/wallet.model"));
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
const appError_1 = __importDefault(require("../utils/appError"));
const logger_1 = __importDefault(require("../utils/logger"));
const notification_service_1 = __importDefault(require("./notification.service"));
const paystack_module_1 = __importDefault(require("./payments/paystack.module"));
const flutterwave_module_1 = __importDefault(require("./payments/flutterwave.module"));
const stripe_module_1 = __importDefault(require("./payments/stripe.module"));
const setting_model_1 = __importDefault(require("../models/setting.model"));
const email_service_1 = __importDefault(require("./email.service"));
const userNotification_model_1 = require("../models/userNotification.model");
class PaymentService {
    /**
     * Helper to resolve payment provider based on order location, user country, and admin settings
     */
    resolveProviderByLocation(order, setting, user, requestedProvider) {
        if (requestedProvider)
            return requestedProvider;
        // 1. Determine Country Code from User profile or Order address
        let countryCode = (user?.countryCode || '').toUpperCase();
        if (!countryCode) {
            if (user?.isNigeria)
                countryCode = 'NG';
            else if (user?.isUk)
                countryCode = 'GB';
            else if (user?.isItaly)
                countryCode = 'IT';
        }
        if (!countryCode) {
            const locationStr = `${order.deliveryAddress?.address || ''} ${order.deliveryAddress?.city || ''} ${order.deliveryAddress?.state || ''} ${order.deliveryAddress?.street || ''}`.toLowerCase();
            if (locationStr.includes('uk') || locationStr.includes('united kingdom') || locationStr.includes('london') || locationStr.includes('gb')) {
                countryCode = 'GB';
            }
            else if (locationStr.includes('us') || locationStr.includes('usa') || locationStr.includes('united states')) {
                countryCode = 'US';
            }
            else if (locationStr.includes('italy') || locationStr.includes('italia') || locationStr.includes('rome') || locationStr.includes('milan')) {
                countryCode = 'IT';
            }
            else if (locationStr.includes('canada') || locationStr.includes('toronto')) {
                countryCode = 'CA';
            }
            else if (locationStr.includes('ghana') || locationStr.includes('accra')) {
                countryCode = 'GH';
            }
            else if (locationStr.includes('kenya') || locationStr.includes('nairobi')) {
                countryCode = 'KE';
            }
            else if (locationStr.includes('south africa') || locationStr.includes('johannesburg')) {
                countryCode = 'ZA';
            }
            else {
                countryCode = 'NG';
            }
        }
        // 2. Check Admin Platform Settings (Country-specific payment provider mapping)
        if (setting?.countryPaymentProviders && Array.isArray(setting.countryPaymentProviders)) {
            const match = setting.countryPaymentProviders.find((c) => c.countryCode?.toUpperCase() === countryCode && c.isActive !== false);
            if (match && match.provider) {
                return match.provider;
            }
        }
        // 3. African Countries default to Paystack / Flutterwave
        const africanCountries = ['NG', 'GH', 'KE', 'ZA', 'EG', 'RW', 'UG', 'TZ', 'CI', 'SN', 'CM'];
        if (africanCountries.includes(countryCode)) {
            return (setting?.defaultPaymentProvider === 'flutterwave' ? 'flutterwave' : 'paystack');
        }
        // 4. Outside Africa (UK, US, Europe, Canada, etc.) defaults to Stripe
        return 'stripe';
    }
    /**
     * Initialize Payment for an Order using preferred provider (Paystack, Flutterwave, or Stripe)
     */
    async initializePayment(orderId, userId, provider, callbackUrl) {
        const orderIdList = orderId.includes(',') ? orderId.split(',').map(s => s.trim()) : [orderId.trim()];
        const orders = await order_model_1.default.find({ _id: { $in: orderIdList } });
        if (!orders || orders.length === 0)
            throw new appError_1.default('Order(s) not found', 404);
        const order = orders[0];
        if (order.customer.toString() !== userId) {
            throw new appError_1.default('Unauthorized access to this order', 403);
        }
        const user = await user_model_1.default.findById(userId);
        if (!user)
            throw new appError_1.default('User not found', 404);
        const setting = await setting_model_1.default.findOne();
        const activeProvider = this.resolveProviderByLocation(order, setting, user, provider);
        const safeEmail = user.email && user.email.trim() !== ''
            ? user.email
            : `${(user.phoneNumber || user._id.toString()).replace(/[^0-9a-zA-Z]/g, '') || 'customer'}@goeat.com`;
        if (!user.email || user.email.trim() === '') {
            user.email = safeEmail;
            await user.save({ validateBeforeSave: false });
        }
        const reference = `ORD_${order._id}_${Date.now()}`;
        const amount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const serverBaseUrl = (process.env.RENDER_EXTERNAL_URL || 'https://go-eat-server-z96s.onrender.com').replace(/\/$/, '');
        const defaultCallbackUrl = `${serverBaseUrl}/api/v1/payments/callback?reference=${reference}`;
        if (activeProvider.toLowerCase() === 'flutterwave') {
            const result = await flutterwave_module_1.default.initializePayment({
                email: safeEmail,
                amount,
                reference,
                customerName: user.name,
                customerPhone: user.phoneNumber,
                redirectUrl: callbackUrl || `${defaultCallbackUrl}&provider=flutterwave`,
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
        else if (activeProvider.toLowerCase() === 'stripe') {
            const result = await stripe_module_1.default.initializePayment({
                email: safeEmail,
                amount,
                reference,
                redirectUrl: callbackUrl || `${defaultCallbackUrl}&provider=stripe`,
                metadata: {
                    orderId: order._id.toString(),
                    customerId: user._id.toString(),
                },
            });
            return {
                authorizationUrl: result.authorizationUrl,
                reference: result.reference,
                provider: 'stripe',
            };
        }
        else {
            // Default: Paystack
            const Restaurant = require('../models/restaurant.model').default;
            const restaurantObj = await Restaurant.findById(order.restaurant);
            const subaccount = restaurantObj?.paystackSubaccountCode;
            let transactionCharge;
            if (subaccount) {
                const commissionRate = setting?.commissionRate || 10;
                const subtotal = order.totalAmount - (order.deliveryFee || 0);
                const adminCut = (subtotal * commissionRate) / 100;
                // Platform retains adminCut + deliveryFee + serviceFee(if any)
                transactionCharge = adminCut + (order.deliveryFee || 0);
            }
            const result = await paystack_module_1.default.initializePayment({
                email: safeEmail,
                amount,
                reference,
                callbackUrl: callbackUrl || `${defaultCallbackUrl}&provider=paystack`,
                metadata: {
                    orderId: order._id.toString(),
                    orderIds: orderIdList.join(','),
                    customerId: user._id.toString(),
                },
                subaccount,
                transactionCharge,
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
     * Verify Payment Status from either Paystack, Flutterwave, or Stripe
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
        else if (provider.toLowerCase() === 'stripe') {
            const data = await stripe_module_1.default.verifyPayment(reference);
            if (data.status !== 'success') {
                throw new appError_1.default('Stripe payment was not successful', 400);
            }
            orderId = data.metadata?.orderId || reference.split('_')[1];
            paymentResult = {
                id: data.id ? String(data.id) : reference,
                status: 'success',
                update_time: new Date().toISOString(),
                provider: 'stripe',
            };
        }
        else {
            const data = await paystack_module_1.default.verifyPayment(reference);
            if (data.status !== 'success') {
                throw new appError_1.default('Paystack payment was not successful', 400);
            }
            orderId = data.metadata?.orderId || reference.split('_')[1];
            const metaOrderIds = data.metadata?.orderIds || '';
            paymentResult = {
                id: data.id ? String(data.id) : reference,
                status: 'success',
                update_time: new Date().toISOString(),
                email_address: data.customer?.email,
                provider: 'paystack',
            };
            const orderIdList = metaOrderIds ? metaOrderIds.split(',').map((s) => s.trim()) : [orderId];
            const orders = await order_model_1.default.find({ _id: { $in: orderIdList } });
            for (const order of orders) {
                if (order.paymentStatus !== 'completed') {
                    order.paymentStatus = 'completed';
                    order.paymentResult = paymentResult;
                    await order.save();
                    // Split logic per order
                    try {
                        const restaurant = await restaurant_model_1.default.findById(order.restaurant);
                        const setting = await setting_model_1.default.findOne();
                        const commissionRate = setting?.commissionRate || 10;
                        const subtotal = order.totalAmount - (order.deliveryFee || 0);
                        const adminCut = (subtotal * commissionRate) / 100;
                        const vendorCut = subtotal - adminCut;
                        if (restaurant && vendorCut > 0) {
                            let vendorWallet = await wallet_model_1.default.findOne({ user: restaurant.owner });
                            if (!vendorWallet) {
                                vendorWallet = await wallet_model_1.default.create({ user: restaurant.owner, balance: 0 });
                            }
                            if (restaurant.paystackSubaccountCode && provider === 'paystack') {
                                logger_1.default.info(`Vendor ${restaurant.owner} automatically paid via Paystack Subaccount.`);
                            }
                            else {
                                vendorWallet.balance += vendorCut;
                                await vendorWallet.save();
                                try {
                                    await this.payoutRestaurant(restaurant.owner.toString(), vendorCut, provider);
                                }
                                catch (payoutErr) {
                                    logger_1.default.warn(`Automatic vendor payout delayed for order ${order._id}: ${payoutErr.message}`);
                                }
                            }
                        }
                    }
                    catch (splitErr) {
                        logger_1.default.error(`Error processing vendor split for order ${order._id}:`, splitErr.message);
                    }
                    // Send notifications upon verified payment
                    try {
                        const restaurant = await restaurant_model_1.default.findById(order.restaurant);
                        const shortId = order._id.toString().slice(-6).toUpperCase();
                        if (restaurant) {
                            await notification_service_1.default.notifyNewOrder(restaurant.owner.toString(), order._id.toString());
                        }
                        if (order.customer) {
                            await notification_service_1.default.sendNotification(order.customer.toString(), `Order Placed! 🍽️`, `Your payment was verified! Order #${shortId} from ${restaurant?.name || 'the outlet'} has been placed successfully and sent to the kitchen!`, { orderId: order._id.toString(), status: 'pending', type: 'ORDER_UPDATE' }, userNotification_model_1.NotificationType.ORDER_UPDATE);
                        }
                    }
                    catch (notifyErr) {
                        logger_1.default.warn('Failed to send order notifications:', notifyErr.message);
                    }
                    // Send Email Receipt to Customer & Order Notification to Vendor upon successful payment
                    try {
                        await order.populate('items.foodItem');
                        const user = await user_model_1.default.findById(order.customer);
                        if (user && user.email && !user.email.includes('customer@goeat.com')) {
                            await email_service_1.default.sendTemplateEmail(user.email, 'ORDER_CONFIRMED', `Order Confirmed: #${order._id.toString().slice(-6).toUpperCase()}`, {
                                orderId: order._id,
                                customerName: user.name,
                                total: order.totalAmount,
                                items: order.items
                            });
                        }
                        const restaurant = await restaurant_model_1.default.findById(order.restaurant).populate('owner');
                        const vendorEmail = restaurant?.businessEmail || restaurant?.owner?.email;
                        if (vendorEmail) {
                            await email_service_1.default.sendTemplateEmail(vendorEmail, 'VENDOR_ORDER_RECEIVED', `New Order Received: #${order._id.toString().slice(-6).toUpperCase()}`, {
                                orderId: order._id,
                                outletName: restaurant?.name || 'Partner',
                                customerName: user?.name || 'Customer',
                                total: order.totalAmount,
                                items: order.items,
                            }, 'partners');
                        }
                    }
                    catch (emailErr) {
                        logger_1.default.warn('Failed to send order email:', emailErr.message);
                    }
                }
            }
            const primaryOrder = orders[0];
            return {
                orderId: primaryOrder ? primaryOrder._id : orderId,
                status: primaryOrder ? primaryOrder.status : 'completed',
                paymentResult,
            };
        }
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
