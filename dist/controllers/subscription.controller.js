"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionController = void 0;
const subscription_service_1 = require("../services/subscription.service");
const subscription_model_1 = require("../models/subscription.model");
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
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
}
exports.SubscriptionController = SubscriptionController;
