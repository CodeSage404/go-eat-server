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
/**
 * @openapi
 * /api/v1/subscriptions/bacs-mandate:
 *   post:
 *     summary: Set up UK Bacs Direct Debit instruction
 *     description: Registers UK bank account sort code and account number for Bacs Direct Debit recurring billing, generates unique mandate reference, and initiates two-stage compliance verification.
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
 *               - accountHolderName
 *               - sortCode
 *               - accountNumber
 *               - customerAgreedGuarantee
 *             properties:
 *               restaurantId:
 *                 type: string
 *                 description: Target restaurant ID (optional if user owns a restaurant)
 *               planTier:
 *                 type: string
 *                 enum: [plus, unlimited]
 *                 default: plus
 *               accountHolderName:
 *                 type: string
 *                 description: Full legal name of bank account holder
 *               sortCode:
 *                 type: string
 *                 description: 6-digit UK bank sort code (e.g. 20-00-00 or 200000)
 *               accountNumber:
 *                 type: string
 *                 description: 8-digit UK bank account number
 *               bankName:
 *                 type: string
 *                 description: Bank or building society name (e.g. Barclays, HSBC)
 *               customerAgreedGuarantee:
 *                 type: boolean
 *                 description: Explicit confirmation that merchant has read and accepted the Direct Debit Guarantee
 *               notes:
 *                 type: string
 *                 description: Internal or sales agent onboarding notes
 *     responses:
 *       200:
 *         description: UK Direct Debit instruction registered successfully with mandate reference
 *       400:
 *         description: Invalid sort code, account number, or unaccepted guarantee
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Internal server error
 */
router.post('/bacs-mandate', auth_middleware_1.protect, subscription_controller_1.SubscriptionController.setupBacsDirectDebit);
/**
 * @openapi
 * /api/v1/subscriptions/admin/bacs-mandates:
 *   get:
 *     summary: Get all UK Direct Debit mandates (Admin Queue)
 *     description: Returns paginated list of restaurant Bacs Direct Debit instructions awaiting compliance verification or active.
 *     tags:
 *       - Subscriptions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, pending_verification, active, rejected, cancelled]
 *           default: all
 *         description: Filter mandates by verification status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Mandate verification queue retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/admin/bacs-mandates', auth_middleware_1.protect, subscription_controller_1.SubscriptionController.getBacsMandatesAdmin);
/**
 * @openapi
 * /api/v1/subscriptions/admin/bacs-mandates/{id}/verify:
 *   patch:
 *     summary: Verify / Approve or Reject UK Direct Debit mandate (Admin)
 *     description: Approves or rejects a merchant's Direct Debit mandate, dispatches verified confirmation email/notification, and activates subscription billing.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *               rejectionReason:
 *                 type: string
 *                 description: Explanation required if action is reject
 *     responses:
 *       200:
 *         description: Mandate verification status updated successfully
 *       400:
 *         description: Invalid action parameter
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Subscription or mandate not found
 *       500:
 *         description: Internal server error
 */
router.patch('/admin/bacs-mandates/:id/verify', auth_middleware_1.protect, subscription_controller_1.SubscriptionController.verifyBacsMandateAdmin);
exports.default = router;
