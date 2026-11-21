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
