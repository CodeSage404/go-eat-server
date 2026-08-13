import { Router } from 'express';
import promoController from '../controllers/promo.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

router.use(protect);

/**
 * @openapi
 * /api/v1/promos/apply:
 *   post:
 *     tags:
 *       - Promotions
 *     summary: Apply a promo code to an order
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, orderAmount]
 *             properties:
 *               code:
 *                 type: string
 *               orderAmount:
 *                 type: number
 *               restaurantId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Promo applied, returns discount amount
 */
router.post('/apply', restrictTo(UserRole.CUSTOMER), promoController.applyPromo);

/**
 * @openapi
 * /api/v1/promos:
 *   post:
 *     tags:
 *       - Promotions
 *     summary: Create a new promotion
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, discountPercentage, expiryDate]
 *             properties:
 *               code:
 *                 type: string
 *               discountPercentage:
 *                 type: number
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Promo created
 */
router.post('/', restrictTo(UserRole.ADMIN, UserRole.VENDOR), promoController.createPromo);

/**
 * @openapi
 * /api/v1/promos/my-promos:
 *   get:
 *     tags:
 *       - Promotions
 *     summary: Get all promotions created by the vendor
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of vendor's promos
 */
router.get('/my-promos', restrictTo(UserRole.VENDOR), promoController.getVendorPromos);

/**
 * @openapi
 * /api/v1/promos/{id}:
 *   patch:
 *     tags:
 *       - Promotions
 *     summary: Update a vendor's promotion
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *               discountPercentage:
 *                 type: number
 *               expiryDate:
 *                 type: string
 *     responses:
 *       200:
 *         description: Promo updated
 */
router.patch('/:id', restrictTo(UserRole.VENDOR), promoController.updateVendorPromo);

/**
 * @openapi
 * /api/v1/promos/{id}:
 *   delete:
 *     tags:
 *       - Promotions
 *     summary: Delete a vendor's promotion
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Promo deleted
 */
router.delete('/:id', restrictTo(UserRole.VENDOR), promoController.deleteVendorPromo);

export default router;
