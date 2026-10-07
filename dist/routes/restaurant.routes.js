"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const restaurant_controller_1 = __importDefault(require("../controllers/restaurant.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const upload_1 = require("../utils/upload");
const router = (0, express_1.Router)();
// Public routes
/**
 * @openapi
 * /api/v1/restaurants:
 *   get:
 *     tags:
 *       - Restaurants
 *     summary: Get all restaurants
 *     description: Retrieve a list of restaurants filtered strictly by active location or country.
 *     parameters:
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: Country name filter (e.g. United Kingdom, Nigeria, Italy)
 *       - in: query
 *         name: countryCode
 *         schema:
 *           type: string
 *         description: 2-letter ISO country code (e.g. GB, NG, IT)
 *       - in: header
 *         name: x-country
 *         schema:
 *           type: string
 *         description: Client current country header
 *       - in: header
 *         name: x-country-code
 *         schema:
 *           type: string
 *         description: Client current 2-letter country code header
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
 *       - in: query
 *         name: dist
 *         schema:
 *           type: number
 *           default: 10000
 *         description: Search radius in meters (e.g. 25000 for 25km)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [Rating, 'Delivery time', 'Delivery fee', Distance]
 *         description: Explicit sorting order for returned restaurants
 *       - in: query
 *         name: shuffle
 *         schema:
 *           type: boolean
 *           default: true
 *         description: When true (default for nearby outlets), applies randomized rotation to give all nearby outlets fair exposure across sessions
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
router.get('/my-restaurant', auth_middleware_1.protect, (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR), restaurant_controller_1.default.getMyRestaurant);
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
router.patch('/my-restaurant', auth_middleware_1.protect, (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR), restaurant_controller_1.default.updateMyRestaurant);
/**
 * @openapi
 * /api/v1/restaurants/me/verification-status:
 *   get:
 *     tags:
 *       - Restaurants
 *     summary: Get vendor restaurant verification and document compliance status
 *     description: Returns current verification compliance status, whether documents have been submitted, and details for NIN and Food Hygiene certificates.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification status details
 *       404:
 *         description: Restaurant not found
 */
router.get('/me/verification-status', auth_middleware_1.protect, (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR), restaurant_controller_1.default.getMyVerificationStatus);
router.get('/my-restaurant/verification-status', auth_middleware_1.protect, (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR), restaurant_controller_1.default.getMyVerificationStatus);
/**
 * @openapi
 * /api/v1/restaurants/me/verification-documents:
 *   post:
 *     tags:
 *       - Restaurants
 *     summary: Upload or update vendor restaurant verification documents
 *     description: Allows vendors to upload their NIN document, Food Hygiene certificate, and optional CAC certificate from within the vendor mobile app.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nin:
 *                 type: string
 *                 format: binary
 *                 description: NIN slip or card document
 *               foodHygiene:
 *                 type: string
 *                 format: binary
 *                 description: Food hygiene certificate
 *               cac:
 *                 type: string
 *                 format: binary
 *                 description: CAC registration certificate (optional)
 *               idNumber:
 *                 type: string
 *                 description: National identification number string
 *     responses:
 *       200:
 *         description: Verification documents successfully submitted
 *       400:
 *         description: Missing required documents
 *       404:
 *         description: Restaurant not found
 */
router.post('/me/verification-documents', auth_middleware_1.protect, (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR), upload_1.upload.fields([
    { name: 'nin', maxCount: 1 },
    { name: 'foodHygiene', maxCount: 1 },
    { name: 'cac', maxCount: 1 },
]), restaurant_controller_1.default.uploadVerificationDocuments);
router.post('/my-restaurant/verification-documents', auth_middleware_1.protect, (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR), upload_1.upload.fields([
    { name: 'nin', maxCount: 1 },
    { name: 'foodHygiene', maxCount: 1 },
    { name: 'cac', maxCount: 1 },
]), restaurant_controller_1.default.uploadVerificationDocuments);
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
router.get('/:id', restaurant_controller_1.default.getRestaurantById);
// Protected routes (for remaining endpoints)
router.use(auth_middleware_1.protect);
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
