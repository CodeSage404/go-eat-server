"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wallet_controller_1 = __importDefault(require("../controllers/wallet.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.protect);
/**
 * @openapi
 * /api/v1/wallets/me:
 *   get:
 *     tags:
 *       - Wallets
 *     summary: Get my wallet balance and transactions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet details and recent transactions
 */
router.get('/me', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER, user_model_1.UserRole.VENDOR), wallet_controller_1.default.getMyWallet);
/**
 * @openapi
 * /api/v1/wallets/request-payout:
 *   post:
 *     tags:
 *       - Wallets
 *     summary: Request a payout (Weekly withdrawals)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Payout processed
 */
router.post('/request-payout', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER, user_model_1.UserRole.VENDOR), wallet_controller_1.default.requestWithdrawal);
exports.default = router;
