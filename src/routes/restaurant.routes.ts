import { Router } from 'express';
import restaurantController from '../controllers/restaurant.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

// Public routes
/**
 * @openapi
 * /api/v1/restaurants:
 *   get:
 *     tags:
 *       - Restaurants
 *     summary: Get all restaurants
 *     description: Retrieve a list of restaurants with optional filters for cuisine and location.
 *     parameters:
 *       - in: query
 *         name: cuisine
 *         schema:
 *           type: string
 *         description: Filter by cuisine type
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitude for nearby search
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: Longitude for nearby search
 *       - in: query
 *         name: distance
 *         schema:
 *           type: number
 *           default: 5
 *         description: Search radius in kilometers
 *     responses:
 *       200:
 *         description: List of restaurants
 */
router.get('/', restaurantController.getAllRestaurants);

/**
 * @openapi
 * /api/v1/restaurants/migrate-promos:
 *   post:
 *     tags:
 *       - Restaurants
 *     summary: Migrate and ensure promo fields on all existing restaurants
 *     responses:
 *       200:
 *         description: Successfully migrated promo fields across all restaurants
 */
router.post('/migrate-promos', restaurantController.migratePromoFields);

// Protected Vendor Routes that must come before /:id to prevent routing conflicts
/**
 * @openapi
 * /api/v1/restaurants/my-restaurant:
 *   get:
 *     tags:
 *       - Restaurants
 *     summary: Get logged in vendor's restaurant
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Restaurant details
 *       404:
 *         description: No restaurant found
 */
router.get(
  '/my-restaurant',
  protect,
  restrictTo(UserRole.VENDOR),
  restaurantController.getMyRestaurant
);

/**
 * @openapi
 * /api/v1/restaurants/my-restaurant:
 *   patch:
 *     tags:
 *       - Restaurants
 *     summary: Update logged in vendor's restaurant
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Vendor updatable fields
 *     responses:
 *       200:
 *         description: Restaurant updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: No restaurant found
 */
router.patch(
  '/my-restaurant',
  protect,
  restrictTo(UserRole.VENDOR),
  restaurantController.updateMyRestaurant
);

/**
 * @openapi
 * /api/v1/restaurants/{id}:
 *   get:
 *     tags:
 *       - Restaurants
 *     summary: Get restaurant by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Restaurant details
 *       404:
 *         description: Restaurant not found
 */
router.get('/:id', restaurantController.getRestaurantById);

// Protected routes (for remaining endpoints)
router.use(protect);

/**
 * @openapi
 * /api/v1/restaurants:
 *   post:
 *     tags:
 *       - Restaurants
 *     summary: Create a restaurant (Vendor only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, description, address, location, openingHours]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               address:
 *                 type: object
 *               location:
 *                 type: object
 *               openingHours:
 *                 type: object
 *     responses:
 *       201:
 *         description: Restaurant created
 */
router.post(
  '/',
  restrictTo(UserRole.VENDOR, UserRole.ADMIN),
  restaurantController.createRestaurant
);

/**
 * @openapi
 * /api/v1/restaurants/{id}:
 *   patch:
 *     tags:
 *       - Restaurants
 *     summary: Update a restaurant (Vendor/Admin only)
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               deliveryFee:
 *                 type: number
 *     responses:
 *       200:
 *         description: Restaurant updated successfully
 *       403:
 *         description: Unauthorized
 */
router.patch(
  '/:id',
  restrictTo(UserRole.VENDOR, UserRole.ADMIN),
  restaurantController.updateRestaurant
);

/**
 * @openapi
 * /api/v1/restaurants/{id}:
 *   delete:
 *     tags:
 *       - Restaurants
 *     summary: Delete a restaurant (Vendor/Admin only)
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
 *         description: Restaurant deleted
 *       403:
 *         description: Unauthorized
 */
router.delete(
  '/:id',
  restrictTo(UserRole.VENDOR, UserRole.ADMIN),
  restaurantController.deleteRestaurant
);

export default router;
