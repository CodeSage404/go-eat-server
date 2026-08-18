"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payment_controller_1 = __importDefault(require("../controllers/payment.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
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
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook received successfully
 */
router.post('/webhook', payment_controller_1.default.handlePaystackWebhook);
/**
 * @openapi
 * /api/v1/payments/webhook/paystack:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Paystack Webhook Handler
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook received successfully
 */
router.post('/webhook/paystack', payment_controller_1.default.handlePaystackWebhook);
/**
 * @openapi
 * /api/v1/payments/webhook/flutterwave:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Flutterwave Webhook Handler
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook received successfully
 */
router.post('/webhook/flutterwave', payment_controller_1.default.handleFlutterwaveWebhook);
/**
 * @openapi
 * /api/v1/payments/verify/{reference}:
 *   get:
 *     tags:
 *       - Payments
 *     summary: Verify transaction status by reference
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment verification status
 */
router.get('/verify/:reference', payment_controller_1.default.verifyPayment);
// ============================================
// PROTECTED USER / CLIENT ROUTES
// ============================================
router.use(auth_middleware_1.protect);
/**
 * @openapi
 * /api/v1/payments/initialize:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Initialize a new payment (Paystack or Flutterwave)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, paymentMethod]
 *             properties:
 *               orderId:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [paystack, flutterwave]
 *     responses:
 *       200:
 *         description: Payment initialized, returns payment URL or details
 */
router.post('/initialize', payment_controller_1.default.initializePayment);
// ============================================
// VENDOR ROUTES
// ============================================
/**
 * @openapi
 * /api/v1/payments/vendor:
 *   get:
 *     tags:
 *       - Payments
 *     summary: Fetch all payments (orders) for a vendor's restaurant
 *     description: Retrieve all payment records associated with the authenticated vendor's restaurant ID.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully fetched vendor payments.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: integer
 *                   example: 10
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: User does not belong to any restaurant.
 */
router.get('/vendor', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR), payment_controller_1.default.getVendorPayments);
/**
 * @openapi
 * /api/v1/payments/banks:
 *   get:
 *     tags:
 *       - Payments
 *     summary: Fetch all supported Paystack banks
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully fetched banks
 */
router.get('/banks', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR), payment_controller_1.default.getBanks);
/**
 * @openapi
 * /api/v1/payments/subaccount:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Setup bank details and Paystack subaccount for a vendor
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bankName, bankCode, accountNumber, accountName]
 *             properties:
 *               bankName:
 *                 type: string
 *               bankCode:
 *                 type: string
 *               accountNumber:
 *                 type: string
 *               accountName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subaccount configured
 */
router.post('/subaccount', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR), payment_controller_1.default.setupSubaccount);
/**
 * @openapi
 * /api/v1/payments/{id}:
 *   patch:
 *     tags:
 *       - Payments
 *     summary: Update payment details manually
 *     description: Update the status or reference of a specific payment/order.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The order/payment ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: completed
 *               reference:
 *                 type: string
 *                 example: PAY-REF-12345
 *     responses:
 *       200:
 *         description: Payment updated successfully.
 *       404:
 *         description: Payment/Order not found.
 */
router.patch('/:id', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), payment_controller_1.default.updatePaymentDetails);
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
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [riderId, amount]
 *             properties:
 *               riderId:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Payout successful
 */
router.post('/payout/rider', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN), payment_controller_1.default.payoutRider);
/**
 * @openapi
 * /api/v1/payments/payout/restaurant:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Payout / transfer money to a restaurant vendor
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [restaurantId, amount]
 *             properties:
 *               restaurantId:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Payout successful
 */
router.post('/payout/restaurant', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN), payment_controller_1.default.payoutRestaurant);
exports.default = router;
