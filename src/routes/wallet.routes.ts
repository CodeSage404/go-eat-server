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
 * /api/v1/wallets/me/transactions/{id}:
 *   get:
 *     tags:
 *       - Wallets
 *     summary: Get single transaction details / receipt
 *     description: Retrieves complete receipt information for a transaction belonging to the authenticated rider or vendor, including populated order or payout bank details.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Transaction details retrieved successfully
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
 *                     transaction:
 *                       type: object
 *       400:
 *         description: Invalid transaction ID
 *       404:
 *         description: Transaction or wallet not found
 */
router.get('/me/transactions/:id', restrictTo(UserRole.RIDER, UserRole.VENDOR), walletController.getTransactionById);

/**
 * @openapi
 * /api/v1/wallets/me/bank:
 *   put:
 *     summary: "Update bank account details (Multi-Country: Nigeria, UK, Italy, International)"
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
router.put('/me/bank', restrictTo(UserRole.RIDER, UserRole.VENDOR), walletController.updateBankDetails);

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
 *         description: Invalid amount, missing PIN, or incorrect withdrawal PIN
 *       401:
 *         description: Unauthorized or missing authentication token
 *       403:
 *         description: Forbidden, only riders or vendors can withdraw
 */
router.post('/me/withdraw', withdrawLimiter, restrictTo(UserRole.RIDER, UserRole.VENDOR), walletController.requestWithdrawal);

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
  .get(restrictTo(UserRole.RIDER, UserRole.VENDOR), walletController.checkWithdrawalPin)
  .post(restrictTo(UserRole.RIDER, UserRole.VENDOR), walletController.setWithdrawalPin);

export default router;

