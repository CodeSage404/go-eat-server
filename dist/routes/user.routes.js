"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = __importDefault(require("../controllers/user.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.protect);
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
    .get(user_controller_1.default.getAddresses)
    .post(user_controller_1.default.addAddress);
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
router.delete('/addresses/:id', user_controller_1.default.deleteAddress);
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
    .get(user_controller_1.default.getFavorites)
    .post(user_controller_1.default.toggleFavorite);
exports.default = router;
