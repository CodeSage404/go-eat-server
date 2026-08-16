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
router.post('/request-payout', restrictTo(UserRole.RIDER, UserRole.VENDOR), walletController.requestWithdrawal);

export default router;
