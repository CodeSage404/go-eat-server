import { Router } from 'express';
import paymentController from '../controllers/payment.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

// ============================================
// PUBLIC WEBHOOK & VERIFICATION ROUTES
// ============================================

/**
 * @openapi
 * /api/v1/payments/webhook:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Default / Legacy Paystack Webhook Handler
 */
router.post('/webhook', paymentController.handlePaystackWebhook);

/**
 * @openapi
 * /api/v1/payments/webhook/paystack:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Paystack Webhook Handler
 */
router.post('/webhook/paystack', paymentController.handlePaystackWebhook);

/**
 * @openapi
 * /api/v1/payments/webhook/flutterwave:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Flutterwave Webhook Handler
 */
router.post('/webhook/flutterwave', paymentController.handleFlutterwaveWebhook);

/**
 * @openapi
 * /api/v1/payments/verify/{reference}:
 *   get:
 *     tags:
 *       - Payments
 *     summary: Verify transaction status by reference
 */
router.get('/verify/:reference', paymentController.verifyPayment);

// ============================================
// PROTECTED USER / CLIENT ROUTES
// ============================================
router.use(protect);

/**
 * @openapi
 * /api/v1/payments/initialize:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Initialize a new payment (Paystack or Flutterwave)
 */
router.post('/initialize', paymentController.initializePayment);

// ============================================
// PROTECTED ADMIN / SYSTEM PAYOUT ROUTES
// ============================================

/**
 * @openapi
 * /api/v1/payments/payout/rider:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Payout / transfer money to a delivery rider
 */
router.post('/payout/rider', restrictTo(UserRole.ADMIN), paymentController.payoutRider);

/**
 * @openapi
 * /api/v1/payments/payout/restaurant:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Payout / transfer money to a restaurant vendor
 */
router.post('/payout/restaurant', restrictTo(UserRole.ADMIN), paymentController.payoutRestaurant);

export default router;
