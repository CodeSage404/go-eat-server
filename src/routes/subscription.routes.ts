import { Router } from 'express';
import { SubscriptionController } from '../controllers/subscription.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

/**
 * @openapi
 * /api/v1/subscriptions/plans:
 *   get:
 *     summary: Retrieve subscription plans
 *     description: Returns available subscription tiers (PAYG, Plus, Unlimited) and pricing for a market (UK, NG, EU)
 *     tags:
 *       - Subscriptions
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         schema:
 *           type: string
 *         description: Optional restaurant ID to derive market
 *     responses:
 *       200:
 *         description: Subscription plans retrieved successfully
 *       500:
 *         description: Internal server error
 */
router.get('/plans', SubscriptionController.getPlans);

/**
 * @openapi
 * /api/v1/subscriptions/{restaurantId}/current:
 *   get:
 *     summary: Get current subscription for a restaurant
 *     description: Returns the active tier, cycle dates, cumulative food sales, and remaining 0% threshold allowance
 *     tags:
 *       - Subscriptions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Active subscription details retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:restaurantId/current', protect, SubscriptionController.getCurrentSubscription);

/**
 * @openapi
 * /api/v1/subscriptions/{restaurantId}/update:
 *   post:
 *     summary: Upgrade or switch subscription tier
 *     description: Changes an outlet's subscription tier to payg, plus, or unlimited
 *     tags:
 *       - Subscriptions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planTier
 *             properties:
 *               planTier:
 *                 type: string
 *                 enum: [payg, plus, unlimited]
 *               paymentProvider:
 *                 type: string
 *                 enum: [stripe, paystack, monnify, bachs]
 *               processorSubscriptionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subscription plan updated successfully
 *       400:
 *         description: Invalid input parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/:restaurantId/update', protect, SubscriptionController.updateSubscription);

export default router;
