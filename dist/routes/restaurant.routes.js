"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const restaurant_controller_1 = __importDefault(require("../controllers/restaurant.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
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
router.get('/', restaurant_controller_1.default.getAllRestaurants);
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
router.post('/migrate-promos', restaurant_controller_1.default.migratePromoFields);
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
router.get('/:id', restaurant_controller_1.default.getRestaurantById);
// Protected routes
router.use(auth_middleware_1.protect);
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
router.get('/my-restaurant', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR), restaurant_controller_1.default.getMyRestaurant);
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
router.patch('/my-restaurant', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR), restaurant_controller_1.default.updateMyRestaurant);
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
router.post('/', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), restaurant_controller_1.default.createRestaurant);
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
router.patch('/:id', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), restaurant_controller_1.default.updateRestaurant);
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
router.delete('/:id', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), restaurant_controller_1.default.deleteRestaurant);
exports.default = router;
