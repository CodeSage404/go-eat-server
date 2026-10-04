"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const wallet_controller_1 = __importDefault(require("../controllers/wallet.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
const withdrawLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // max 5 withdrawal attempts per 5 minutes per IP/user
    message: {
        status: 'fail',
        message: 'Too many withdrawal attempts, please wait 5 minutes before trying again.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
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
 * /api/v1/wallets/me/bank:
 *   put:
 *     summary: Update bank account details (Multi-Country: Nigeria, UK, Italy, International)
 *     tags:
 *       - Wallets
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accountNumber, accountName]
 *             properties:
 *               accountNumber:
 *                 type: string
 *               bankCode:
 *                 type: string
 *               accountName:
 *                 type: string
 *               bankName:
 *                 type: string
 *               bankSlug:
 *                 type: string
 *               bankLogo:
 *                 type: string
 *               sortCode:
 *                 type: string
 *               routingNumber:
 *                 type: string
 *               iban:
 *                 type: string
 *               countryCode:
 *                 type: string
 *               provider:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.put('/me/bank', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER, user_model_1.UserRole.VENDOR), wallet_controller_1.default.updateBankDetails);
/**
 * @openapi
 * /api/v1/wallets/banks:
 *   get:
 *     summary: Get list of supported banks by country / location
 *     tags:
 *       - Wallets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: countryCode
 *         required: false
 *         schema:
 *           type: string
 *           example: GB
 *         description: Optional country code (NG, GB, IT, US)
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/banks', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER, user_model_1.UserRole.VENDOR), wallet_controller_1.default.getBanks);
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
router.post('/request-payout', withdrawLimiter, (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER, user_model_1.UserRole.VENDOR), wallet_controller_1.default.requestWithdrawal);
/**
 * @openapi
 * /api/v1/wallets/me/withdraw:
 *   post:
 *     tags:
 *       - Wallets
 *     summary: Request a withdrawal from courier or vendor available balance
 *     description: Deducts requested funds from available balance and initiates payout processing. Enforces settlement hold rules, available balance checks, and 4-digit PIN verification.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, pin]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 5000
 *               pin:
 *                 type: string
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: Withdrawal requested successfully
 *       400:
 *         description: Invalid amount or missing PIN
 *       401:
 *         description: Incorrect withdrawal PIN or unauthorized
 *       403:
 *         description: Forbidden, only riders or vendors can withdraw
 */
router.post('/me/withdraw', withdrawLimiter, (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER, user_model_1.UserRole.VENDOR), wallet_controller_1.default.requestWithdrawal);
/**
 * @openapi
 * /api/v1/wallets/me/pin:
 *   get:
 *     tags:
 *       - Wallets
 *     summary: Check if withdrawal PIN is set up
 *     description: Returns whether the authenticated rider or vendor has configured a 4-digit withdrawal security PIN.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Withdrawal PIN setup status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     hasWithdrawalPin:
 *                       type: boolean
 *                       example: true
 *   post:
 *     tags:
 *       - Wallets
 *     summary: Set or update 4-digit withdrawal PIN
 *     description: Sets up a new 4-digit withdrawal security PIN or updates an existing one (with current PIN verification).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pin]
 *             properties:
 *               pin:
 *                 type: string
 *                 example: "1234"
 *                 description: New 4-digit withdrawal PIN
 *               currentPin:
 *                 type: string
 *                 example: "0000"
 *                 description: Current 4-digit withdrawal PIN (required only if already configured)
 *     responses:
 *       200:
 *         description: Withdrawal PIN updated successfully
 *       400:
 *         description: Invalid PIN format (must be 4 numeric digits)
 *       401:
 *         description: Current PIN is incorrect
 */
router.route('/me/pin')
    .get((0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER, user_model_1.UserRole.VENDOR), wallet_controller_1.default.checkWithdrawalPin)
    .post((0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER, user_model_1.UserRole.VENDOR), wallet_controller_1.default.setWithdrawalPin);
exports.default = router;
