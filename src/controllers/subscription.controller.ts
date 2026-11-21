import { Request, Response } from 'express';
import { SubscriptionService } from '../services/subscription.service';
import { SUBSCRIPTION_PLAN_CONFIGS, SubscriptionPlanTier } from '../models/subscription.model';
import Restaurant from '../models/restaurant.model';

export class SubscriptionController {
  /**
   * Get subscription plans configuration for the current outlet's market
   */
  public static async getPlans(req: Request, res: Response) {
    try {
      const { restaurantId } = req.query;
      let market = 'NG';

      if (restaurantId) {
        const restaurant = await Restaurant.findById(restaurantId);
        if (restaurant) {
          market = SubscriptionService.getRestaurantMarket(restaurant);
        }
      }

      const plans = SUBSCRIPTION_PLAN_CONFIGS[market as 'UK' | 'NG' | 'EU'];
      return res.status(200).json({
        success: true,
        market,
        plans,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve plans',
      });
    }
  }

  /**
   * Get the current active subscription and threshold usage for a restaurant
   */
  public static async getCurrentSubscription(req: Request, res: Response) {
    try {
      const restaurantId = Array.isArray(req.params.restaurantId) ? req.params.restaurantId[0] : req.params.restaurantId;
      const sub = await SubscriptionService.getOrCreateSubscription(restaurantId);
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
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve current subscription',
      });
    }
  }

  /**
   * Upgrade or change subscription tier
   */
  public static async updateSubscription(req: Request, res: Response) {
    try {
      const restaurantId = Array.isArray(req.params.restaurantId) ? req.params.restaurantId[0] : req.params.restaurantId;
      const { planTier, paymentProvider, processorSubscriptionId } = req.body;

      if (!['payg', 'plus', 'unlimited'].includes(planTier)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid plan tier. Must be payg, plus, or unlimited',
        });
      }

      const sub = await SubscriptionService.updateSubscriptionPlan(
        restaurantId,
        planTier as SubscriptionPlanTier,
        paymentProvider,
        processorSubscriptionId
      );

      return res.status(200).json({
        success: true,
        message: `Successfully updated subscription to ${planTier.toUpperCase()}`,
        subscription: sub,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to update subscription',
      });
    }
  }
}
