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
 */
router.get('/:id', restaurantController.getRestaurantById);

// Protected routes
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

router.patch(
  '/:id',
  restrictTo(UserRole.VENDOR, UserRole.ADMIN),
  restaurantController.updateRestaurant
);

router.delete(
  '/:id',
  restrictTo(UserRole.VENDOR, UserRole.ADMIN),
  restaurantController.deleteRestaurant
);

export default router;
