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
 */
router.post('/webhook', payment_controller_1.default.handlePaystackWebhook);
router.post('/webhook/paystack', payment_controller_1.default.handlePaystackWebhook);
router.post('/webhook/flutterwave', payment_controller_1.default.handleFlutterwaveWebhook);
/**
 * @openapi
 * /api/v1/payments/verify/{reference}:
 *   get:
 *     tags:
 *       - Payments
 *     summary: Verify transaction status by reference
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
 */
router.post('/initialize', payment_controller_1.default.initializePayment);
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
router.post('/payout/rider', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN), payment_controller_1.default.payoutRider);
/**
 * @openapi
 * /api/v1/payments/payout/restaurant:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Payout / transfer money to a restaurant vendor
 */
router.post('/payout/restaurant', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN), payment_controller_1.default.payoutRestaurant);
exports.default = router;
