import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import walletController from '../controllers/wallet.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

const withdrawLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // max 5 withdrawal attempts per 5 minutes per IP/user
  message: {
    status: 'fail',
    message: 'Too many withdrawal attempts, please wait 5 minutes before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(protect);

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
router.get('/me', restrictTo(UserRole.RIDER, UserRole.VENDOR), walletController.getMyWallet);

/**
 * @openapi
 * /api/v1/wallets/me/bank:
 *   put:
 *     summary: Update bank account details
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
 *             properties:
 *               accountNumber:
 *                 type: string
 *               bankCode:
 *                 type: string
 *               accountName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.put('/me/bank', restrictTo(UserRole.RIDER, UserRole.VENDOR), walletController.updateBankDetails);

/**
 * @openapi
 * /api/v1/wallets/banks:
 *   get:
 *     summary: Get list of supported banks
 *     tags:
 *       - Wallets
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/banks', restrictTo(UserRole.RIDER, UserRole.VENDOR), walletController.getBanks);

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
router.post('/request-payout', withdrawLimiter, restrictTo(UserRole.RIDER, UserRole.VENDOR), walletController.requestWithdrawal);

/**
 * @openapi
 * /api/v1/wallets/me/withdraw:
 *   post:
 *     tags:
 *       - Wallets
 *     summary: Request a withdrawal from courier or vendor available balance
 *     description: Deducts requested funds from available balance and initiates payout processing. Enforces settlement hold rules and available balance checks.
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
 *                 example: 5000
 *     responses:
 *       200:
 *         description: Withdrawal requested successfully
 *       400:
 *         description: Invalid amount or insufficient balance
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, only riders or vendors can withdraw
 */
router.post('/me/withdraw', withdrawLimiter, restrictTo(UserRole.RIDER, UserRole.VENDOR), walletController.requestWithdrawal);

export default router;

