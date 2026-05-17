import { Router } from 'express';
import walletController from '../controllers/wallet.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

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
router.post('/request-payout', restrictTo(UserRole.RIDER, UserRole.VENDOR), walletController.requestWithdrawal);

export default router;
