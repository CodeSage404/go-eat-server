import { Router } from 'express';
import userController from '../controllers/user.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

/**
 * @openapi
 * /api/v1/users/addresses:
 *   get:
 *     tags:
 *       - Addresses
 *     summary: Get all saved addresses
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved addresses.
 *   post:
 *     tags:
 *       - Addresses
 *     summary: Save a new address
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [label, address, location]
 *             properties:
 *               label:
 *                 type: string
 *                 example: Home
 *               address:
 *                 type: string
 *                 example: 123 Main St, London
 *               location:
 *                 type: object
 *                 properties:
 *                   type: { type: string, example: Point }
 *                   coordinates: { type: array, items: { type: number }, example: [51.5074, -0.1278] }
 *               isDefault:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Address saved.
 */
router.route('/addresses')
  .get(userController.getAddresses)
  .post(userController.addAddress);

/**
 * @openapi
 * /api/v1/users/addresses/{id}:
 *   delete:
 *     tags:
 *       - Addresses
 *     summary: Remove a saved address
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Address removed.
 */
router.delete('/addresses/:id', userController.deleteAddress);

/**
 * @openapi
 * /api/v1/users/favorites:
 *   get:
 *     tags:
 *       - Favorites
 *     summary: Get favorite restaurants
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of favorited restaurants.
 *   post:
 *     tags:
 *       - Favorites
 *     summary: Toggle restaurant favorite
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [restaurantId]
 *             properties:
 *               restaurantId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated favorites list.
 */
router.route('/favorites')
  .get(userController.getFavorites)
  .post(userController.toggleFavorite);

export default router;
