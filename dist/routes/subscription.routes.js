"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const subscription_controller_1 = require("../controllers/subscription.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/**
 * @openapi
 * /api/v1/subscriptions/admin/all:
 *   get:
 *     summary: Get all platform subscribers and MRR metrics (Admin)
 *     description: Returns paginated list of restaurant and partner subscriptions with aggregate MRR, tier counts, and subscriber profiles.
 *     tags:
 *       - Subscriptions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by outlet name, owner name, or email
 *       - in: query
 *         name: planTier
 *         schema:
 *           type: string
 *           enum: [all, payg, plus, unlimited]
 *         description: Filter by subscription tier
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, active, past_due, cancelled, trialing]
 *         description: Filter by status
 *       - in: query
 *         name: market
 *         schema:
 *           type: string
 *           enum: [all, NG, UK, EU]
 *         description: Filter by operating market
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 25
 *     responses:
 *       200:
 *         description: Subscriptions and metrics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/admin/all', auth_middleware_1.protect, subscription_controller_1.SubscriptionController.getAllSubscriptionsAdmin);
/**
 * @openapi
 * /api/v1/subscriptions/admin/{id}/cancel:
 *   patch:
 *     summary: Cancel a subscription (Admin)
 *     description: Terminates an active outlet subscription and flags it for cancellation.
 *     tags:
 *       - Subscriptions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription document ID
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 *       404:
 *         description: Subscription not found
 *       500:
 *         description: Internal server error
 */
router.patch('/admin/:id/cancel', auth_middleware_1.protect, subscription_controller_1.SubscriptionController.cancelSubscriptionAdmin);
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
router.get('/plans', subscription_controller_1.SubscriptionController.getPlans);
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
router.get('/:restaurantId/current', auth_middleware_1.protect, subscription_controller_1.SubscriptionController.getCurrentSubscription);
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
router.post('/:restaurantId/update', auth_middleware_1.protect, subscription_controller_1.SubscriptionController.updateSubscription);
/**
 * @openapi
 * /api/v1/subscriptions/subscribe:
 *   post:
 *     summary: Initialize subscription checkout session
 *     description: Initializes a hosted recurring checkout redirect session via Bachs.io (Nigeria / NGN) or Stripe Billing (UK / GBP with Bacs Direct Debit and Card, & EU / EUR) for partner outlet subscriptions
 *     tags:
 *       - Subscriptions
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planTier
 *             properties:
 *               restaurantId:
 *                 type: string
 *                 description: Restaurant ID (optional if user has registered restaurant)
 *               planTier:
 *                 type: string
 *                 enum: [payg, plus, unlimited]
 *               market:
 *                 type: string
 *                 enum: [NG, UK, EU]
 *               callbackUrl:
 *                 type: string
 *               cancelUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Checkout session initialized successfully (includes Bacs Direct Debit for UK) or PAYG enrolled
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/subscribe', auth_middleware_1.protect, subscription_controller_1.SubscriptionController.initializeSubscriptionCheckout);
/**
 * @openapi
 * /api/v1/subscriptions/verify-payment:
 *   get:
 *     summary: Verify subscription payment and activate plan
 *     description: Verifies reference with Bachs.io or Stripe gateway and upgrades restaurant subscription tier
 *     tags:
 *       - Subscriptions
 *     parameters:
 *       - in: query
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *           enum: [bachs, stripe]
 *       - in: query
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: planTier
 *         required: true
 *         schema:
 *           type: string
 *           enum: [payg, plus, unlimited]
 *     responses:
 *       200:
 *         description: Subscription payment verified and plan activated
 *       400:
 *         description: Verification failed
 *       500:
 *         description: Internal server error
 */
router.get('/verify-payment', subscription_controller_1.SubscriptionController.verifySubscriptionPayment);
exports.default = router;
