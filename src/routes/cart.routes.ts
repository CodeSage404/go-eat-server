import express from 'express';
import { getCart, updateCart, clearCart } from '../controllers/cart.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @openapi
 * tags:
 *   name: Cart
 *   description: Cart management API
 */
router.use(protect); // All cart routes require authentication

/**
 * @openapi
 * /api/v1/cart:
 *   get:
 *     summary: Get user's cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', getCart);

/**
 * @openapi
 * /api/v1/cart/update:
 *   post:
 *     summary: Update cart items
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               restaurantId:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     menuItemId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *     responses:
 *       200:
 *         description: Cart updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 */
router.post('/update', updateCart);

/**
 * @openapi
 * /api/v1/cart/clear:
 *   delete:
 *     summary: Clear user's cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared successfully
 *       401:
 *         description: Unauthorized
 */
router.delete('/clear', clearCart);

export default router;
