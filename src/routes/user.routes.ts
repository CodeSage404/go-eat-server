import { Router } from 'express';
import userController from '../controllers/user.controller';
import authController from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

/**
 * @openapi
 * /api/v1/users/location:
 *   put:
 *     tags:
 *       - Users
 *     summary: Persist User Location to Database
 *     description: Saves the user's detected or manually selected address string and coordinates [lng, lat] to their MongoDB user profile.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, coordinates]
 *             properties:
 *               address:
 *                 type: string
 *                 example: Agbani, Enugu, Nigeria
 *               coordinates:
 *                 type: array
 *                 items:
 *                   type: number
 *                 example: [7.5191, 6.3084]
 *     responses:
 *       200:
 *         description: User location saved to database successfully.
 *       400:
 *         description: Missing address or coordinates.
 */
router.put('/location', authController.updateUserLocation);

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

/**
 * @openapi
 * /api/v1/users/profile:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get authenticated user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully.
 *   put:
 *     tags:
 *       - Users
 *     summary: Update user profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               profileImage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully.
 */
router.route('/profile')
  .get(userController.getProfile)
  .put(userController.updateProfile);

export default router;
