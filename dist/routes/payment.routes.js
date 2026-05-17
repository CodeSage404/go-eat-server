"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payment_controller_1 = __importDefault(require("../controllers/payment.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
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
router.post('/webhook', payment_controller_1.default.handleWebhook);
// Protected routes
router.use(auth_middleware_1.protect);
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
router.post('/initialize', payment_controller_1.default.initializePayment);
exports.default = router;
