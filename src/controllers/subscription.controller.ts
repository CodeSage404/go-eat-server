import { Request, Response } from 'express';
import { SubscriptionService } from '../services/subscription.service';
import { OutletSubscription, SUBSCRIPTION_PLAN_CONFIGS, SubscriptionPlanTier } from '../models/subscription.model';
import Restaurant, { RestaurantStatus } from '../models/restaurant.model';
import bachsModule from '../services/payments/bachs.module';
import stripeModule from '../services/payments/stripe.module';

export class SubscriptionController {
  /**
   * Admin: Retrieve all platform subscriptions with KPI metrics, search, and filters
   */
  public static async getAllSubscriptionsAdmin(req: Request, res: Response) {
    try {
      const { search, planTier, status, market, page = 1, limit = 25 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const filter: any = {};
      if (planTier && planTier !== 'all') {
        filter.planTier = planTier;
      }
      if (status && status !== 'all') {
        filter.status = status;
      }
      if (market && market !== 'all') {
        filter.market = market;
      }

      const subscriptions = await OutletSubscription.find(filter)
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

      const total = await OutletSubscription.countDocuments(filter);

      // Compute aggregate KPIs for Active subscribers
      const allActive = await OutletSubscription.find({ status: 'active' });
      let mrrNGN = 0;
      let mrrGBP = 0;
      let mrrEUR = 0;
      let plusCount = 0;
      let unlimitedCount = 0;
      let paygCount = 0;

      for (const sub of allActive) {
        if (sub.currency === 'NGN') mrrNGN += sub.monthlyFee || 0;
        else if (sub.currency === 'GBP') mrrGBP += sub.monthlyFee || 0;
        else if (sub.currency === 'EUR') mrrEUR += sub.monthlyFee || 0;

        if (sub.planTier === 'plus') plusCount++;
        else if (sub.planTier === 'unlimited') unlimitedCount++;
        else paygCount++;
      }

      let resultItems = subscriptions;
      if (search && String(search).trim() !== '') {
        const queryTerm = String(search).toLowerCase();
        resultItems = subscriptions.filter((sub: any) => {
          const rest = sub.restaurantId;
          const owner = rest?.owner;
          return (
            rest?.name?.toLowerCase().includes(queryTerm) ||
            rest?.email?.toLowerCase().includes(queryTerm) ||
            owner?.name?.toLowerCase().includes(queryTerm) ||
            owner?.email?.toLowerCase().includes(queryTerm) ||
            sub.planTier?.toLowerCase().includes(queryTerm)
          );
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
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve subscribers list',
      });
    }
  }

  /**
   * Admin: Cancel or terminate a subscription
   */
  public static async cancelSubscriptionAdmin(req: Request, res: Response) {
    try {
      const subscriptionId = req.params.id;
      const sub = await OutletSubscription.findById(subscriptionId);
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
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to cancel subscription',
      });
    }
  }

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

  /**
   * Initialize Subscription Checkout (Bachs for Nigeria, Stripe for UK/EU)
   */
  public static async initializeSubscriptionCheckout(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      let { restaurantId, planTier, market, callbackUrl, cancelUrl } = req.body;

      if (!restaurantId && user) {
        let found = await Restaurant.findOne({ owner: user._id });
        if (!found) {
          // Auto-provision pending restaurant profile for the partner
          found = await Restaurant.create({
            owner: user._id,
            name: `${user.name || 'Partner'}'s Kitchen`,
            phone: user.phoneNumber || user.phone || '08000000000',
            businessEmail: user.email,
            status: RestaurantStatus.PENDING,
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

      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ success: false, message: 'Restaurant not found' });
      }

      const resolvedMarket = market || SubscriptionService.getRestaurantMarket(restaurant);
      const config = SUBSCRIPTION_PLAN_CONFIGS[resolvedMarket as 'UK' | 'NG' | 'EU']?.[planTier as SubscriptionPlanTier];

      if (!config) {
        return res.status(400).json({ success: false, message: 'Invalid plan or market configuration' });
      }

      // PAYG requires no upfront payment
      if (planTier === 'payg' || config.monthlyFee <= 0) {
        const sub = await SubscriptionService.updateSubscriptionPlan(restaurantId, 'payg');
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
      const returnUrl =
        callbackUrl ||
        `https://go-eat-server-z96s.onrender.com/api/v1/subscriptions/verify-payment?reference=${encodeURIComponent(
          reference
        )}&provider=${resolvedMarket === 'NG' ? 'bachs' : 'stripe'}&restaurantId=${restaurantId}&planTier=${planTier}`;

      let checkoutResult: { authorizationUrl: string; reference: string; provider: string };

      if (resolvedMarket === 'NG') {
        const result = await bachsModule.initializePayment({
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
      } else {
        const result = await stripeModule.initializePayment({
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
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to initialize subscription checkout',
      });
    }
  }

  /**
   * Verify and activate subscription after checkout redirect
   */
  public static async verifySubscriptionPayment(req: Request, res: Response) {
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
        const verification = await stripeModule.verifyPayment(String(reference));
        isSuccess = verification.status === 'success' || verification.status === 'paid';
      } else {
        const verification = await bachsModule.verifyPayment(String(reference));
        isSuccess = verification.status === 'success';
      }

      if (isSuccess) {
        const sub = await SubscriptionService.updateSubscriptionPlan(
          String(restaurantId),
          planTier as SubscriptionPlanTier,
          provider as any,
          String(reference)
        );

        if (req.accepts('html')) {
          return res.redirect(
            `https://goeatone.com/partners/tiers?success=true&plan=${planTier}&ref=${reference}`
          );
        }

        return res.status(200).json({
          success: true,
          message: `Subscription to ${String(planTier).toUpperCase()} activated successfully`,
          subscription: sub,
        });
      } else {
        if (req.accepts('html')) {
          return res.redirect(
            `https://goeatone.com/partners/tiers?error=payment_unverified&ref=${reference}`
          );
        }
        return res.status(400).json({
          success: false,
          message: 'Payment verification failed or was not completed',
        });
      }
    } catch (error: any) {
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
