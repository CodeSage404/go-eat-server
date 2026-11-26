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
const mongoose_1 = __importDefault(require("mongoose"));
const crypto_1 = __importDefault(require("crypto"));
const subscription_service_1 = require("../services/subscription.service");
const subscription_model_1 = require("../models/subscription.model");
const restaurant_model_1 = __importStar(require("../models/restaurant.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const bachs_module_1 = __importDefault(require("../services/payments/bachs.module"));
const stripe_module_1 = __importDefault(require("../services/payments/stripe.module"));
const email_service_1 = __importDefault(require("../services/email.service"));
const notification_service_1 = __importDefault(require("../services/notification.service"));
const logger_1 = __importDefault(require("../utils/logger"));
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
                        activeSubscribers: allActive.length,
                        mrrNGN,
                        mrrGBP,
                        mrrEUR,
                        totalGeneratedNGN: mrrNGN,
                        totalGeneratedGBP: mrrGBP,
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
            let body = req.body;
            if (typeof body === 'string') {
                try {
                    body = JSON.parse(body);
                }
                catch {
                    // ignore
                }
            }
            let { restaurantId, planTier, market, callbackUrl, cancelUrl } = body || {};
            if (planTier) {
                planTier = String(planTier).toLowerCase().trim();
            }
            // Sanitize restaurantId if passed as empty string or string 'undefined'
            if (restaurantId &&
                (typeof restaurantId !== 'string' ||
                    restaurantId.trim() === '' ||
                    restaurantId === 'undefined' ||
                    restaurantId === 'null')) {
                restaurantId = undefined;
            }
            // Safe market resolution helper
            const marketStr = (market && typeof market === 'string' ? market.toUpperCase().trim() : '');
            let restaurant = null;
            if (restaurantId && mongoose_1.default.Types.ObjectId.isValid(restaurantId)) {
                restaurant = await restaurant_model_1.default.findById(restaurantId);
            }
            // If restaurant not found by provided ID, try finding by owner
            if (!restaurant && user?._id) {
                restaurant = await restaurant_model_1.default.findOne({ owner: user._id });
                if (restaurant) {
                    restaurantId = restaurant._id.toString();
                }
            }
            // If still no restaurant, auto-provision pending storefront with full valid schema defaults
            if (!restaurant && user) {
                const resolvedCountry = marketStr === 'UK' ? 'United Kingdom' : 'Nigeria';
                const resolvedCountryCode = marketStr === 'UK' ? 'GB' : 'NG';
                const resolvedCity = marketStr === 'UK' ? 'London' : 'Lagos';
                const resolvedZip = marketStr === 'UK' ? 'EC1A 1BB' : '100001';
                const defaultCoords = marketStr === 'UK' ? [-0.1276, 51.5074] : [3.3792, 6.5244];
                restaurant = await restaurant_model_1.default.create({
                    owner: user._id,
                    name: `${user.name || 'Partner'}'s Kitchen`,
                    description: `Storefront for ${user.name || 'Partner'}`,
                    phone: user.phoneNumber || user.phone || '08000000000',
                    businessEmail: user.email,
                    status: restaurant_model_1.RestaurantStatus.PENDING,
                    subscriptionPlan: planTier || 'plus',
                    baseCurrency: marketStr === 'UK' ? 'GBP' : marketStr === 'EU' ? 'EUR' : 'NGN',
                    country: resolvedCountry,
                    countryCode: resolvedCountryCode,
                    isNigeria: marketStr !== 'UK' && marketStr !== 'EU',
                    isUk: marketStr === 'UK',
                    isItaly: marketStr === 'EU',
                    address: {
                        street: 'Storefront Location Pending',
                        city: resolvedCity,
                        state: resolvedCity,
                        zipCode: resolvedZip,
                        country: resolvedCountry,
                        countryCode: resolvedCountryCode,
                    },
                    location: {
                        type: 'Point',
                        coordinates: defaultCoords,
                    },
                    outletType: 'Restaurant',
                });
                restaurantId = restaurant._id.toString();
            }
            if (!restaurantId || !restaurant) {
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
            const resolvedMarket = ['UK', 'NG', 'EU'].includes(marketStr)
                ? marketStr
                : subscription_service_1.SubscriptionService.getRestaurantMarket(restaurant);
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
            const userName = user?.name || restaurant.name || 'GoEatOne Partner';
            const reference = `SUB_${restaurantId}_${planTier.toUpperCase()}_${Date.now()}`;
            // Resolve subscription payment provider with Admin Override support
            const Setting = require('../models/setting.model').default;
            const setting = await Setting.findOne();
            let effectiveProvider = resolvedMarket === 'NG' ? 'bachs' : 'stripe';
            if (setting?.forceSubscriptionPaymentProvider === 'stripe') {
                effectiveProvider = 'stripe';
            }
            else if (setting?.forceSubscriptionPaymentProvider === 'bachs') {
                effectiveProvider = 'bachs';
            }
            else if (setting?.forceGlobalPaymentProvider === 'stripe') {
                effectiveProvider = 'stripe';
            }
            else if (setting?.forceGlobalPaymentProvider === 'bachs') {
                effectiveProvider = 'bachs';
            }
            const returnUrl = callbackUrl ||
                `https://go-eat-server-z96s.onrender.com/api/v1/subscriptions/verify-payment?reference=${encodeURIComponent(reference)}&provider=${effectiveProvider}&restaurantId=${restaurantId}&planTier=${planTier}`;
            let checkoutResult;
            if (effectiveProvider === 'bachs') {
                const bachsAmount = config.currency === 'GBP'
                    ? config.monthlyFee * 2000
                    : config.currency === 'EUR'
                        ? config.monthlyFee * 1700
                        : config.monthlyFee;
                const result = await bachs_module_1.default.initializePayment({
                    email: userEmail,
                    name: userName,
                    amount: bachsAmount,
                    reference,
                    metadata: {
                        type: 'partner_subscription',
                        restaurantId,
                        planTier,
                        market: resolvedMarket,
                    },
                    callbackUrl: returnUrl,
                    cancelUrl: cancelUrl || 'https://goeatone.com/partners/tiers',
                    description: `GoEatOne Partner ${planTier.toUpperCase()} Plan Subscription`,
                });
                checkoutResult = {
                    authorizationUrl: result.authorizationUrl,
                    reference: result.reference,
                    provider: 'bachs',
                };
            }
            else {
                const isUkMarket = resolvedMarket === 'UK';
                // When Stripe is forced on an NGN market subscription, convert to GBP base for checkout
                const stripeCurrency = (config.currency === 'NGN' ? 'gbp' : config.currency || 'gbp').toLowerCase();
                const stripeAmount = config.currency === 'NGN'
                    ? Math.round((config.monthlyFee / 2000) * 100) / 100
                    : config.monthlyFee;
                const result = await stripe_module_1.default.initializePayment({
                    email: userEmail,
                    amount: stripeAmount,
                    reference,
                    currency: stripeCurrency,
                    redirectUrl: returnUrl,
                    isSubscription: true,
                    mode: 'subscription',
                    productName: `GoEatOne Partner ${planTier.toUpperCase()} Plan (${isUkMarket ? 'UK Direct Debit / Card' : 'Subscription'})`,
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
            logger_1.default.error(`[SubscriptionCheckout] Initialization error: ${error?.stack || error?.message || error}`);
            const status = error.statusCode || error.status || 500;
            return res.status(status >= 400 && status < 600 ? status : 500).json({
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
                // Dispatch dedicated subscription confirmation receipt email to partner
                try {
                    const restaurant = await restaurant_model_1.default.findById(restaurantId).populate('owner');
                    const owner = restaurant?.owner;
                    const ownerEmail = owner?.email || restaurant?.businessEmail;
                    if (ownerEmail) {
                        const config = subscription_model_1.SUBSCRIPTION_PLAN_CONFIGS[sub.market]?.[planTier];
                        const planDisplayNames = {
                            payg: 'Pay As You Go',
                            plus: 'Plus Plan',
                            unlimited: 'Unlimited Capped',
                        };
                        const planCommissionLabels = {
                            payg: '11% - 19% Standard Commission',
                            plus: 'Flat 5% Commission',
                            unlimited: '0% on first sales threshold (8% excess)',
                        };
                        await email_service_1.default.sendSubscriptionConfirmation(ownerEmail, {
                            partnerName: owner?.name || restaurant?.name || 'Partner',
                            restaurantName: restaurant?.name || 'Your Kitchen',
                            planTier: String(planTier),
                            planName: planDisplayNames[String(planTier)] || String(planTier).toUpperCase(),
                            amountFormatted: `${sub.currency === 'NGN' ? '₦' : sub.currency === 'GBP' ? '£' : '€'}${sub.monthlyFee?.toLocaleString()} / month`,
                            commission: planCommissionLabels[String(planTier)] || `${(config?.commissionRate || 0.05) * 100}%`,
                            reference: String(reference),
                            renewalDate: sub.nextRenewalDate ? new Date(sub.nextRenewalDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined,
                        });
                    }
                }
                catch (mailErr) {
                    logger_1.default.warn(`Failed to dispatch subscription confirmation email: ${mailErr.message}`);
                }
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
    /**
     * Merchant / Sales Agent: Set up UK Bacs Direct Debit instruction for restaurant subscription
     */
    static async setupBacsDirectDebit(req, res) {
        try {
            const user = req.user;
            const { restaurantId: paramRestaurantId, planTier = 'plus', accountHolderName, sortCode, accountNumber, bankName, customerAgreedGuarantee, notes, } = req.body;
            if (!customerAgreedGuarantee) {
                return res.status(400).json({
                    success: false,
                    message: 'You must confirm and accept the UK Direct Debit Guarantee to proceed.',
                });
            }
            if (!accountHolderName || !accountHolderName.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Account holder name is required.',
                });
            }
            const cleanSortCode = String(sortCode || '').replace(/[^0-9]/g, '');
            if (cleanSortCode.length !== 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid 6-digit UK sort code is required (e.g. 20-00-00).',
                });
            }
            const cleanAccountNumber = String(accountNumber || '').replace(/[^0-9]/g, '');
            if (cleanAccountNumber.length !== 8) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid 8-digit UK bank account number is required.',
                });
            }
            let restaurantId = paramRestaurantId;
            let restaurant = null;
            if (restaurantId) {
                restaurant = await restaurant_model_1.default.findById(restaurantId).populate('owner');
            }
            else if (user) {
                restaurant = await restaurant_model_1.default.findOne({ owner: user._id });
                if (restaurant) {
                    restaurantId = restaurant._id.toString();
                }
            }
            if (!restaurant) {
                return res.status(404).json({
                    success: false,
                    message: 'Restaurant profile not found for Direct Debit mandate.',
                });
            }
            const formattedSortCode = `${cleanSortCode.slice(0, 2)}-${cleanSortCode.slice(2, 4)}-${cleanSortCode.slice(4, 6)}`;
            const accountNumberMasked = `****${cleanAccountNumber.slice(-4)}`;
            const mandateReference = `GOEAT-BACS-${crypto_1.default.randomBytes(4).toString('hex').toUpperCase()}`;
            const validTier = (['plus', 'unlimited'].includes(planTier) ? planTier : 'plus');
            const config = subscription_model_1.SUBSCRIPTION_PLAN_CONFIGS.UK[validTier];
            const now = new Date();
            const currentCycleEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            let subscription = await subscription_model_1.OutletSubscription.findOne({ restaurantId });
            if (subscription) {
                subscription.planTier = validTier;
                subscription.market = 'UK';
                subscription.currency = 'GBP';
                subscription.monthlyFee = config.monthlyFee;
                subscription.status = 'pending_verification';
                subscription.paymentProvider = 'bachs';
                subscription.bacsMandate = {
                    accountHolderName: accountHolderName.trim(),
                    sortCode: formattedSortCode,
                    accountNumberMasked,
                    bankName: bankName ? bankName.trim() : undefined,
                    mandateReference,
                    status: 'pending_verification',
                    submittedAt: now,
                    submittedBy: user
                        ? {
                            userId: user._id,
                            name: user.name || user.email,
                            role: user.role || 'partner',
                        }
                        : undefined,
                    customerAgreedGuarantee: true,
                    agreedAt: now,
                    notes: notes ? String(notes).trim() : undefined,
                };
                await subscription.save();
            }
            else {
                subscription = await subscription_model_1.OutletSubscription.create({
                    restaurantId,
                    planTier: validTier,
                    market: 'UK',
                    currency: 'GBP',
                    monthlyFee: config.monthlyFee,
                    status: 'pending_verification',
                    startDate: now,
                    currentCycleStart: now,
                    currentCycleEnd,
                    nextRenewalDate: currentCycleEnd,
                    paymentProvider: 'bachs',
                    bacsMandate: {
                        accountHolderName: accountHolderName.trim(),
                        sortCode: formattedSortCode,
                        accountNumberMasked,
                        bankName: bankName ? bankName.trim() : undefined,
                        mandateReference,
                        status: 'pending_verification',
                        submittedAt: now,
                        submittedBy: user
                            ? {
                                userId: user._id,
                                name: user.name || user.email,
                                role: user.role || 'partner',
                            }
                            : undefined,
                        customerAgreedGuarantee: true,
                        agreedAt: now,
                        notes: notes ? String(notes).trim() : undefined,
                    },
                });
            }
            // Send Advance Notice Email to Restaurant Owner
            const ownerUser = restaurant.owner?.email ? restaurant.owner : await user_model_1.default.findById(restaurant.owner);
            const recipientEmail = ownerUser?.email || restaurant.businessEmail || restaurant.email;
            if (recipientEmail && !recipientEmail.includes('@goeat.com')) {
                await email_service_1.default.sendBacsMandateNotice(recipientEmail, {
                    partnerName: ownerUser?.name || restaurant.name || 'Partner',
                    restaurantName: restaurant.name,
                    mandateReference,
                    sortCode: formattedSortCode,
                    accountNumberMasked,
                    planName: validTier === 'unlimited' ? 'Unlimited (0% Commission)' : 'Plus (5% Commission)',
                    amountFormatted: `£${config.monthlyFee}`,
                });
            }
            // Dispatch real-time in-app / push notification
            if (ownerUser?._id) {
                await notification_service_1.default.sendNotification(ownerUser._id.toString(), 'UK Direct Debit Mandate Registered 📋', `Mandate ${mandateReference} for ${restaurant.name} has been submitted for compliance verification.`, {
                    type: 'bacs_mandate_submitted',
                    mandateReference,
                    restaurantId,
                });
            }
            return res.status(200).json({
                success: true,
                message: 'UK Direct Debit instruction submitted successfully. Verification is pending.',
                mandate: {
                    mandateReference,
                    status: 'pending_verification',
                    sortCode: formattedSortCode,
                    accountNumberMasked,
                    accountHolderName: accountHolderName.trim(),
                    planTier: validTier,
                    monthlyFee: config.monthlyFee,
                    submittedAt: now,
                },
                subscription,
            });
        }
        catch (error) {
            logger_1.default.error(`[setupBacsDirectDebit] Error: ${error.stack || error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to submit UK Direct Debit instruction',
            });
        }
    }
    /**
     * Admin: Get all UK Direct Debit mandates with verification queue
     */
    static async getBacsMandatesAdmin(req, res) {
        try {
            const { status = 'all', page = 1, limit = 20 } = req.query;
            const skip = (Number(page) - 1) * Number(limit);
            const filter = {
                'bacsMandate.status': { $in: ['pending_verification', 'active', 'rejected', 'cancelled'] },
            };
            if (status && status !== 'all') {
                filter['bacsMandate.status'] = status;
            }
            let query = subscription_model_1.OutletSubscription.find(filter)
                .populate({
                path: 'restaurantId',
                select: 'name businessEmail phone businessPhone address location cuisine owner isUk',
                populate: {
                    path: 'owner',
                    select: 'name email phoneNumber',
                },
            })
                .sort({ 'bacsMandate.submittedAt': -1, createdAt: -1 });
            const [mandates, total, pendingCount] = await Promise.all([
                query.skip(skip).limit(Number(limit)),
                subscription_model_1.OutletSubscription.countDocuments(filter),
                subscription_model_1.OutletSubscription.countDocuments({ 'bacsMandate.status': 'pending_verification' }),
            ]);
            return res.status(200).json({
                success: true,
                mandates,
                total,
                page: Number(page),
                totalPages: Math.ceil(total / Number(limit)),
                pendingCount,
            });
        }
        catch (error) {
            logger_1.default.error(`[getBacsMandatesAdmin] Error: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to retrieve Direct Debit mandates',
            });
        }
    }
    /**
     * Admin: Verify / Approve or Reject UK Bacs Direct Debit mandate
     */
    static async verifyBacsMandateAdmin(req, res) {
        try {
            const adminUser = req.user;
            const { id } = req.params;
            const { action, rejectionReason } = req.body;
            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid action. Must be "approve" or "reject".',
                });
            }
            const subscription = await subscription_model_1.OutletSubscription.findById(id).populate({
                path: 'restaurantId',
                select: 'name businessEmail phone businessPhone owner',
                populate: {
                    path: 'owner',
                    select: 'name email phoneNumber',
                },
            });
            if (!subscription || !subscription.bacsMandate) {
                return res.status(404).json({
                    success: false,
                    message: 'Subscription or Direct Debit mandate not found.',
                });
            }
            const now = new Date();
            const restaurant = subscription.restaurantId;
            const ownerUser = restaurant?.owner;
            const recipientEmail = ownerUser?.email || restaurant?.businessEmail;
            if (action === 'approve') {
                subscription.bacsMandate.status = 'active';
                subscription.bacsMandate.verifiedAt = now;
                subscription.bacsMandate.verifiedBy = {
                    userId: adminUser?._id,
                    name: adminUser?.name || 'Compliance Team',
                };
                subscription.status = 'active';
                subscription.currentCycleStart = now;
                subscription.currentCycleEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                subscription.nextRenewalDate = subscription.currentCycleEnd;
                await subscription.save();
                const planName = subscription.planTier === 'unlimited' ? 'Unlimited (0% Commission)' : 'Plus (5% Commission)';
                const monthlyFeeFormatted = `£${subscription.monthlyFee}`;
                const nextDebitFormatted = subscription.nextRenewalDate.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                });
                if (recipientEmail && !recipientEmail.includes('@goeat.com')) {
                    await email_service_1.default.sendBacsMandateApproved(recipientEmail, {
                        partnerName: ownerUser?.name || restaurant?.name || 'Partner',
                        restaurantName: restaurant?.name || 'Your Kitchen',
                        mandateReference: subscription.bacsMandate.mandateReference || 'BACS-MANDATE',
                        planName,
                        monthlyFee: monthlyFeeFormatted,
                        nextDebitDate: nextDebitFormatted,
                    });
                }
                if (ownerUser?._id) {
                    await notification_service_1.default.sendNotification(ownerUser._id.toString(), 'Direct Debit Mandate Approved! 🎉', `Your UK Direct Debit mandate for ${restaurant?.name || 'your outlet'} is verified and active.`, {
                        type: 'bacs_mandate_approved',
                        mandateReference: subscription.bacsMandate.mandateReference,
                    });
                }
                return res.status(200).json({
                    success: true,
                    message: 'Direct Debit mandate approved and subscription activated successfully',
                    subscription,
                });
            }
            else {
                subscription.bacsMandate.status = 'rejected';
                subscription.bacsMandate.rejectionReason = rejectionReason || 'Information could not be verified by compliance team';
                subscription.status = 'past_due';
                await subscription.save();
                if (ownerUser?._id) {
                    await notification_service_1.default.sendNotification(ownerUser._id.toString(), 'Direct Debit Verification Update ⚠️', `Your Direct Debit mandate requires attention: ${subscription.bacsMandate.rejectionReason}`, {
                        type: 'bacs_mandate_rejected',
                        rejectionReason: subscription.bacsMandate.rejectionReason,
                    });
                }
                return res.status(200).json({
                    success: true,
                    message: 'Direct Debit mandate marked as rejected',
                    subscription,
                });
            }
        }
        catch (error) {
            logger_1.default.error(`[verifyBacsMandateAdmin] Error: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to update Direct Debit mandate status',
            });
        }
    }
}
exports.SubscriptionController = SubscriptionController;
