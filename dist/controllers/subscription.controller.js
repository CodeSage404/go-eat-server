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
exports.SubscriptionController = void 0;
const subscription_service_1 = require("../services/subscription.service");
const subscription_model_1 = require("../models/subscription.model");
const restaurant_model_1 = __importStar(require("../models/restaurant.model"));
const bachs_module_1 = __importDefault(require("../services/payments/bachs.module"));
const stripe_module_1 = __importDefault(require("../services/payments/stripe.module"));
class SubscriptionController {
    /**
     * Admin: Retrieve all platform subscriptions with KPI metrics, search, and filters
     */
    static async getAllSubscriptionsAdmin(req, res) {
        try {
            const { search, planTier, status, market, page = 1, limit = 25 } = req.query;
            const skip = (Number(page) - 1) * Number(limit);
            const filter = {};
            if (planTier && planTier !== 'all') {
                filter.planTier = planTier;
            }
            if (status && status !== 'all') {
                filter.status = status;
            }
            if (market && market !== 'all') {
                filter.market = market;
            }
            const subscriptions = await subscription_model_1.OutletSubscription.find(filter)
                .populate({
                path: 'restaurantId',
                select: 'name email phoneNumber address city country logo coverImage status owner',
                populate: {
                    path: 'owner',
                    select: 'name email phoneNumber role',
                },
            })
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(Number(limit));
            const total = await subscription_model_1.OutletSubscription.countDocuments(filter);
            // Compute aggregate KPIs for Active subscribers
            const allActive = await subscription_model_1.OutletSubscription.find({ status: 'active' });
            let mrrNGN = 0;
            let mrrGBP = 0;
            let mrrEUR = 0;
            let plusCount = 0;
            let unlimitedCount = 0;
            let paygCount = 0;
            for (const sub of allActive) {
                if (sub.currency === 'NGN')
                    mrrNGN += sub.monthlyFee || 0;
                else if (sub.currency === 'GBP')
                    mrrGBP += sub.monthlyFee || 0;
                else if (sub.currency === 'EUR')
                    mrrEUR += sub.monthlyFee || 0;
                if (sub.planTier === 'plus')
                    plusCount++;
                else if (sub.planTier === 'unlimited')
                    unlimitedCount++;
                else
                    paygCount++;
            }
            let resultItems = subscriptions;
            if (search && String(search).trim() !== '') {
                const queryTerm = String(search).toLowerCase();
                resultItems = subscriptions.filter((sub) => {
                    const rest = sub.restaurantId;
                    const owner = rest?.owner;
                    return (rest?.name?.toLowerCase().includes(queryTerm) ||
                        rest?.email?.toLowerCase().includes(queryTerm) ||
                        owner?.name?.toLowerCase().includes(queryTerm) ||
                        owner?.email?.toLowerCase().includes(queryTerm) ||
                        sub.planTier?.toLowerCase().includes(queryTerm));
                });
            }
            return res.status(200).json({
                success: true,
                data: {
                    subscriptions: resultItems,
                    total,
                    page: Number(page),
                    totalPages: Math.ceil(total / Number(limit)),
                    pagination: {
                        total,
                        page: Number(page),
                        pages: Math.ceil(total / Number(limit)),
                        limit: Number(limit),
                    },
                    metrics: {
                        totalSubscribers: total,
                        activeCount: allActive.length,
                        mrrNGN,
                        mrrGBP,
                        mrrEUR,
                        plusCount,
                        unlimitedCount,
                        paygCount,
                        tierDistribution: {
                            payg: paygCount,
                            plus: plusCount,
                            unlimited: unlimitedCount,
                        },
                    },
                },
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to retrieve subscribers list',
            });
        }
    }
    /**
     * Admin: Cancel or terminate a subscription
     */
    static async cancelSubscriptionAdmin(req, res) {
        try {
            const subscriptionId = req.params.id;
            const sub = await subscription_model_1.OutletSubscription.findById(subscriptionId);
            if (!sub) {
                return res.status(404).json({ success: false, message: 'Subscription not found' });
            }
            sub.status = 'cancelled';
            sub.cancelledAt = new Date();
            sub.cancelAtPeriodEnd = true;
            await sub.save();
            return res.status(200).json({
                success: true,
                message: 'Subscription successfully cancelled',
                subscription: sub,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to cancel subscription',
            });
        }
    }
    /**
     * Get subscription plans configuration for the current outlet's market
     */
    static async getPlans(req, res) {
        try {
            const { restaurantId } = req.query;
            let market = 'NG';
            if (restaurantId) {
                const restaurant = await restaurant_model_1.default.findById(restaurantId);
                if (restaurant) {
                    market = subscription_service_1.SubscriptionService.getRestaurantMarket(restaurant);
                }
            }
            const plans = subscription_model_1.SUBSCRIPTION_PLAN_CONFIGS[market];
            return res.status(200).json({
                success: true,
                market,
                plans,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to retrieve plans',
            });
        }
    }
    /**
     * Get the current active subscription and threshold usage for a restaurant
     */
    static async getCurrentSubscription(req, res) {
        try {
            const restaurantId = Array.isArray(req.params.restaurantId) ? req.params.restaurantId[0] : req.params.restaurantId;
            const sub = await subscription_service_1.SubscriptionService.getOrCreateSubscription(restaurantId);
            const remainingAllowance = Math.max(0, sub.foodSalesThreshold - sub.currentCycleFoodSales);
            return res.status(200).json({
                success: true,
                subscription: {
                    planTier: sub.planTier,
                    market: sub.market,
                    currency: sub.currency,
                    monthlyFee: sub.monthlyFee,
                    status: sub.status,
                    currentCycleStart: sub.currentCycleStart,
                    currentCycleEnd: sub.currentCycleEnd,
                    nextRenewalDate: sub.nextRenewalDate,
                    currentCycleFoodSales: sub.currentCycleFoodSales,
                    foodSalesThreshold: sub.foodSalesThreshold,
                    remainingAllowance,
                    isFoundingPartnerPromo: sub.isFoundingPartnerPromo,
                    foundingPartnerPromoEnd: sub.foundingPartnerPromoEnd,
                },
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to retrieve current subscription',
            });
        }
    }
    /**
     * Upgrade or change subscription tier
     */
    static async updateSubscription(req, res) {
        try {
            const restaurantId = Array.isArray(req.params.restaurantId) ? req.params.restaurantId[0] : req.params.restaurantId;
            const { planTier, paymentProvider, processorSubscriptionId } = req.body;
            if (!['payg', 'plus', 'unlimited'].includes(planTier)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid plan tier. Must be payg, plus, or unlimited',
                });
            }
            const sub = await subscription_service_1.SubscriptionService.updateSubscriptionPlan(restaurantId, planTier, paymentProvider, processorSubscriptionId);
            return res.status(200).json({
                success: true,
                message: `Successfully updated subscription to ${planTier.toUpperCase()}`,
                subscription: sub,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to update subscription',
            });
        }
    }
    /**
     * Initialize Subscription Checkout (Bachs for Nigeria, Stripe for UK/EU)
     */
    static async initializeSubscriptionCheckout(req, res) {
        try {
            const user = req.user;
            let { restaurantId, planTier, market, callbackUrl, cancelUrl } = req.body;
            if (!restaurantId && user) {
                let found = await restaurant_model_1.default.findOne({ owner: user._id });
                if (!found) {
                    // Auto-provision pending restaurant profile for the partner
                    found = await restaurant_model_1.default.create({
                        owner: user._id,
                        name: `${user.name || 'Partner'}'s Kitchen`,
                        phone: user.phoneNumber || user.phone || '08000000000',
                        businessEmail: user.email,
                        status: restaurant_model_1.RestaurantStatus.PENDING,
                        subscriptionPlan: planTier,
                        baseCurrency: market === 'UK' ? 'GBP' : market === 'EU' ? 'EUR' : 'NGN',
                    });
                }
                restaurantId = found._id.toString();
            }
            if (!restaurantId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication or valid Restaurant ID is required to initialize subscription',
                });
            }
            if (!['payg', 'plus', 'unlimited'].includes(planTier)) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid plan tier required (payg, plus, or unlimited)',
                });
            }
            const restaurant = await restaurant_model_1.default.findById(restaurantId);
            if (!restaurant) {
                return res.status(404).json({ success: false, message: 'Restaurant not found' });
            }
            const resolvedMarket = market || subscription_service_1.SubscriptionService.getRestaurantMarket(restaurant);
            const config = subscription_model_1.SUBSCRIPTION_PLAN_CONFIGS[resolvedMarket]?.[planTier];
            if (!config) {
                return res.status(400).json({ success: false, message: 'Invalid plan or market configuration' });
            }
            // PAYG requires no upfront payment
            if (planTier === 'payg' || config.monthlyFee <= 0) {
                const sub = await subscription_service_1.SubscriptionService.updateSubscriptionPlan(restaurantId, 'payg');
                return res.status(200).json({
                    success: true,
                    message: 'Subscribed to Pay As You Go successfully',
                    requiresPayment: false,
                    subscription: sub,
                });
            }
            // Paid tiers (Plus / Unlimited)
            const userEmail = user?.email || restaurant.businessEmail || 'partner@goeatone.com';
            const userName = user?.name || restaurant.name || 'Go-Eat Partner';
            const reference = `SUB_${restaurantId}_${planTier.toUpperCase()}_${Date.now()}`;
            const returnUrl = callbackUrl ||
                `https://go-eat-server-z96s.onrender.com/api/v1/subscriptions/verify-payment?reference=${encodeURIComponent(reference)}&provider=${resolvedMarket === 'NG' ? 'bachs' : 'stripe'}&restaurantId=${restaurantId}&planTier=${planTier}`;
            let checkoutResult;
            if (resolvedMarket === 'NG') {
                const result = await bachs_module_1.default.initializePayment({
                    email: userEmail,
                    name: userName,
                    amount: config.monthlyFee,
                    reference,
                    metadata: {
                        type: 'partner_subscription',
                        restaurantId,
                        planTier,
                        market: resolvedMarket,
                    },
                    callbackUrl: returnUrl,
                    cancelUrl: cancelUrl || 'https://goeatone.com/partners/tiers',
                    description: `Go-Eat Partner ${planTier.toUpperCase()} Plan Subscription`,
                });
                checkoutResult = {
                    authorizationUrl: result.authorizationUrl,
                    reference: result.reference,
                    provider: 'bachs',
                };
            }
            else {
                const result = await stripe_module_1.default.initializePayment({
                    email: userEmail,
                    amount: config.monthlyFee,
                    reference,
                    currency: config.currency.toLowerCase(),
                    redirectUrl: returnUrl,
                    metadata: {
                        type: 'partner_subscription',
                        restaurantId,
                        planTier,
                        market: resolvedMarket,
                    },
                });
                checkoutResult = {
                    authorizationUrl: result.authorizationUrl,
                    reference: result.reference,
                    provider: 'stripe',
                };
            }
            return res.status(200).json({
                success: true,
                requiresPayment: true,
                ...checkoutResult,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to initialize subscription checkout',
            });
        }
    }
    /**
     * Verify and activate subscription after checkout redirect
     */
    static async verifySubscriptionPayment(req, res) {
        try {
            const { reference, provider = 'bachs', restaurantId, planTier } = req.query;
            if (!reference || !restaurantId || !planTier) {
                return res.status(400).json({
                    success: false,
                    message: 'reference, restaurantId, and planTier are required query parameters',
                });
            }
            let isSuccess = false;
            if (String(provider).toLowerCase() === 'stripe') {
                const verification = await stripe_module_1.default.verifyPayment(String(reference));
                isSuccess = verification.status === 'success' || verification.status === 'paid';
            }
            else {
                const verification = await bachs_module_1.default.verifyPayment(String(reference));
                isSuccess = verification.status === 'success';
            }
            if (isSuccess) {
                const sub = await subscription_service_1.SubscriptionService.updateSubscriptionPlan(String(restaurantId), planTier, provider, String(reference));
                if (req.accepts('html')) {
                    return res.redirect(`https://goeatone.com/partners/tiers?success=true&plan=${planTier}&ref=${reference}`);
                }
                return res.status(200).json({
                    success: true,
                    message: `Subscription to ${String(planTier).toUpperCase()} activated successfully`,
                    subscription: sub,
                });
            }
            else {
                if (req.accepts('html')) {
                    return res.redirect(`https://goeatone.com/partners/tiers?error=payment_unverified&ref=${reference}`);
                }
                return res.status(400).json({
                    success: false,
                    message: 'Payment verification failed or was not completed',
                });
            }
        }
        catch (error) {
            if (req.accepts('html')) {
                return res.redirect(`https://goeatone.com/partners/tiers?error=server_error`);
            }
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to verify subscription payment',
            });
        }
    }
}
exports.SubscriptionController = SubscriptionController;
