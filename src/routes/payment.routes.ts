import { Router } from 'express';
import paymentController from '../controllers/payment.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

/**
 * @openapi
 * /api/v1/payments/webhook:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Paystack Webhook Handler
 *     description: Endpoint for Paystack to send transaction events. Should not be called manually.
 *     responses:
 *       200:
 *         description: Webhook received successfully
 */
router.post('/webhook', paymentController.handleWebhook);

// Protected routes
router.use(protect);

/**
 * @openapi
 * /api/v1/payments/initialize:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Initialize a new payment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment initialized, returns authorization URL
 */
router.post('/initialize', paymentController.initializePayment);

export default router;
