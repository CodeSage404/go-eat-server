"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionService = void 0;
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
const subscription_model_1 = require("../models/subscription.model");
class SubscriptionService {
    /**
     * Resolves the restaurant's market: UK, NG, or EU
     */
    static getRestaurantMarket(restaurant) {
        const code = (restaurant.countryCode || restaurant.address?.countryCode || '').toUpperCase();
        if (code === 'GB' || code === 'UK' || restaurant.isUk)
            return 'UK';
        if (code === 'IT' || code === 'DE' || code === 'FR' || code === 'ES' || restaurant.isItaly)
            return 'EU';
        return 'NG';
    }
    /**
     * Gets or initializes the active subscription profile for an outlet
     */
    static async getOrCreateSubscription(restaurantId) {
        let sub = await subscription_model_1.OutletSubscription.findOne({ restaurantId });
        if (!sub) {
            const restaurant = await restaurant_model_1.default.findById(restaurantId);
            if (!restaurant) {
                throw new Error('Restaurant not found');
            }
            const market = this.getRestaurantMarket(restaurant);
            const currency = market === 'UK' ? 'GBP' : market === 'EU' ? 'EUR' : 'NGN';
            const now = new Date();
            const oneMonthLater = new Date(now);
            oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
            const isFounding = restaurant.isFoundingPartner || false;
            const foundingExpires = restaurant.foundingPartnerOfferExpiresAt;
            const planTier = (restaurant.subscriptionPlan || 'payg');
            const planConfig = subscription_model_1.SUBSCRIPTION_PLAN_CONFIGS[market][planTier] || subscription_model_1.SUBSCRIPTION_PLAN_CONFIGS[market].payg;
            sub = await subscription_model_1.OutletSubscription.create({
                restaurantId,
                planTier,
                market,
                currency,
                monthlyFee: 0,
                status: 'active',
                startDate: now,
                currentCycleStart: now,
                currentCycleEnd: oneMonthLater,
                nextRenewalDate: oneMonthLater,
                currentCycleFoodSales: 0,
                foodSalesThreshold: planConfig.foodSalesThreshold,
                isFoundingPartnerPromo: isFounding && foundingExpires ? new Date() <= foundingExpires : false,
                foundingPartnerPromoEnd: foundingExpires,
            });
        }
        // Check if subscription cycle needs monthly rollover
        const now = new Date();
        if (now >= sub.currentCycleEnd) {
            sub.currentCycleStart = now;
            const nextEnd = new Date(now);
            nextEnd.setMonth(nextEnd.getMonth() + 1);
            sub.currentCycleEnd = nextEnd;
            sub.nextRenewalDate = nextEnd;
            sub.currentCycleFoodSales = 0; // Reset cumulative counter for new cycle
            await sub.save();
        }
        return sub;
    }
    /**
     * Computes commission for an order according to the exact mathematical algorithm
     * defined in the Partner Subscriptions Technical Implementation Instructions.
     */
    static async calculateOrderCommission(restaurantId, foodSalesAmount, nonFoodSalesAmount = 0, categoryCommissionRate = 0.15) {
        const sub = await this.getOrCreateSubscription(restaurantId);
        const totalOrderAmount = foodSalesAmount + nonFoodSalesAmount;
        const now = new Date();
        const isFoundingPromoActive = sub.isFoundingPartnerPromo &&
            sub.foundingPartnerPromoEnd &&
            now <= sub.foundingPartnerPromoEnd;
        // 1. Founding Partner Promotion: 0% marketplace sales commission for qualifying period
        if (isFoundingPromoActive) {
            return {
                planTier: sub.planTier,
                isFoundingPartnerPromo: true,
                totalOrderAmount,
                eligibleFoodSales: foodSalesAmount,
                nonFoodSales: nonFoodSalesAmount,
                foodCommissionCharged: 0,
                nonFoodCommissionCharged: 0,
                totalCommissionCharged: 0,
                effectiveCommissionRate: 0,
                cumulativeFoodSalesBefore: sub.currentCycleFoodSales,
                cumulativeFoodSalesAfter: sub.currentCycleFoodSales + foodSalesAmount,
                foodSalesThreshold: sub.foodSalesThreshold,
                remainingThresholdAllowance: sub.foodSalesThreshold,
            };
        }
        // 2. Plus Plan: Flat 5% across eligible sales
        if (sub.planTier === 'plus') {
            const commission = totalOrderAmount * 0.05;
            return {
                planTier: 'plus',
                isFoundingPartnerPromo: false,
                totalOrderAmount,
                eligibleFoodSales: foodSalesAmount,
                nonFoodSales: nonFoodSalesAmount,
                foodCommissionCharged: foodSalesAmount * 0.05,
                nonFoodCommissionCharged: nonFoodSalesAmount * 0.05,
                totalCommissionCharged: commission,
                effectiveCommissionRate: 0.05,
                cumulativeFoodSalesBefore: sub.currentCycleFoodSales,
                cumulativeFoodSalesAfter: sub.currentCycleFoodSales + foodSalesAmount,
                foodSalesThreshold: sub.foodSalesThreshold,
                remainingThresholdAllowance: 0,
            };
        }
        // 3. Unlimited Plan: 0% on food sales up to threshold, 8% on excess
        if (sub.planTier === 'unlimited') {
            const threshold = sub.foodSalesThreshold;
            const prevSales = sub.currentCycleFoodSales;
            const newTotalSales = prevSales + foodSalesAmount;
            let foodCommission = 0;
            if (prevSales >= threshold) {
                // Entire food order is already above threshold: 8% on everything
                foodCommission = foodSalesAmount * 0.08;
            }
            else if (newTotalSales > threshold) {
                // Straddles threshold: portion up to threshold is 0%, remainder is 8%
                const abovePortion = newTotalSales - threshold;
                foodCommission = abovePortion * 0.08;
            }
            else {
                // Completely within 0% cap
                foodCommission = 0;
            }
            // Non-food items do not count towards food threshold and use category PAYG rate
            const nonFoodCommission = nonFoodSalesAmount * categoryCommissionRate;
            const totalCommission = foodCommission + nonFoodCommission;
            const remainingAllowance = Math.max(0, threshold - newTotalSales);
            return {
                planTier: 'unlimited',
                isFoundingPartnerPromo: false,
                totalOrderAmount,
                eligibleFoodSales: foodSalesAmount,
                nonFoodSales: nonFoodSalesAmount,
                foodCommissionCharged: foodCommission,
                nonFoodCommissionCharged: nonFoodCommission,
                totalCommissionCharged: totalCommission,
                effectiveCommissionRate: totalOrderAmount > 0 ? totalCommission / totalOrderAmount : 0,
                cumulativeFoodSalesBefore: prevSales,
                cumulativeFoodSalesAfter: newTotalSales,
                foodSalesThreshold: threshold,
                remainingThresholdAllowance: remainingAllowance,
            };
        }
        // 4. Pay As You Go (Default): Standard category rate (11%–19%, default 15%)
        const commission = totalOrderAmount * categoryCommissionRate;
        return {
            planTier: 'payg',
            isFoundingPartnerPromo: false,
            totalOrderAmount,
            eligibleFoodSales: foodSalesAmount,
            nonFoodSales: nonFoodSalesAmount,
            foodCommissionCharged: foodSalesAmount * categoryCommissionRate,
            nonFoodCommissionCharged: nonFoodSalesAmount * categoryCommissionRate,
            totalCommissionCharged: commission,
            effectiveCommissionRate: categoryCommissionRate,
            cumulativeFoodSalesBefore: sub.currentCycleFoodSales,
            cumulativeFoodSalesAfter: sub.currentCycleFoodSales + foodSalesAmount,
            foodSalesThreshold: 0,
            remainingThresholdAllowance: 0,
        };
    }
    /**
     * Records an order's food sales into the active subscription cycle counter
     */
    static async recordOrderCompletion(restaurantId, foodSalesAmount) {
        const sub = await this.getOrCreateSubscription(restaurantId);
        sub.currentCycleFoodSales = (sub.currentCycleFoodSales || 0) + foodSalesAmount;
        await sub.save();
        await restaurant_model_1.default.findByIdAndUpdate(restaurantId, {
            cycleFoodSales: sub.currentCycleFoodSales,
            cycleStartDate: sub.currentCycleStart,
            cycleEndDate: sub.currentCycleEnd,
            subscriptionPlan: sub.planTier,
            subscriptionStatus: sub.status,
        });
    }
    /**
     * Upgrades or switches a partner's subscription tier
     */
    static async updateSubscriptionPlan(restaurantId, targetTier, paymentProvider, processorSubscriptionId) {
        const sub = await this.getOrCreateSubscription(restaurantId);
        const config = subscription_model_1.SUBSCRIPTION_PLAN_CONFIGS[sub.market][targetTier];
        sub.planTier = targetTier;
        sub.monthlyFee = config.monthlyFee;
        sub.foodSalesThreshold = config.foodSalesThreshold;
        if (paymentProvider)
            sub.paymentProvider = paymentProvider;
        if (processorSubscriptionId)
            sub.processorSubscriptionId = processorSubscriptionId;
        sub.cancelAtPeriodEnd = false;
        sub.status = 'active';
        await sub.save();
        const isSubscribed = targetTier !== 'payg';
        await restaurant_model_1.default.findByIdAndUpdate(restaurantId, {
            subscriptionPlan: targetTier,
            subscriptionStatus: 'active',
            isSubscribed,
        });
        return sub;
    }
}
exports.SubscriptionService = SubscriptionService;
