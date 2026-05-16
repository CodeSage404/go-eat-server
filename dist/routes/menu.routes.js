"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const menu_controller_1 = __importDefault(require("../controllers/menu.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)({ mergeParams: true }); // Enable merging params from parent router
// Public routes
/**
 * @openapi
 * /api/v1/restaurants/{restaurantId}/menu:
 *   get:
 *     tags:
 *       - Menu
 *     summary: Get full menu for a restaurant
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Full menu with categories and items
 */
router.get('/', menu_controller_1.default.getMenu);
// Protected routes (Vendor/Admin only)
router.use(auth_middleware_1.protect);
router.use((0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN));
/**
 * @openapi
 * /api/v1/restaurants/{restaurantId}/menu/categories:
 *   post:
 *     tags:
 *       - Menu
 *     summary: Create a menu category
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created
 */
router.post('/categories', menu_controller_1.default.createCategory);
/**
 * @openapi
 * /api/v1/restaurants/{restaurantId}/menu/items:
 *   post:
 *     tags:
 *       - Menu
 *     summary: Add a food item to a category
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, category, price]
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               price:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Food item added
 */
router.post('/items', menu_controller_1.default.addFoodItem);
router.patch('/items/:id', menu_controller_1.default.updateFoodItem);
router.delete('/items/:id', menu_controller_1.default.deleteFoodItem);
exports.default = router;
