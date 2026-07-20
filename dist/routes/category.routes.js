"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const category_controller_1 = __importDefault(require("../controllers/category.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
/**
 * @openapi
 * /api/v1/categories:
 *   get:
 *     tags:
 *       - Categories
 *     summary: Get all food categories
 *     description: Returns a list of all food & cravings categories (e.g. Rice, Drinks, Fast Food, Swallow) with image URLs for the Home screen.
 *     responses:
 *       200:
 *         description: List of categories retrieved successfully.
 */
router.get('/', category_controller_1.default.getAllCategories);
/**
 * @openapi
 * /api/v1/categories/{id}:
 *   get:
 *     tags:
 *       - Categories
 *     summary: Get category details by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category details.
 *       404:
 *         description: Category not found.
 */
router.get('/:id', category_controller_1.default.getCategoryById);
// Protected Admin Routes
router.use(auth_middleware_1.protect);
router.use((0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN));
/**
 * @openapi
 * /api/v1/categories:
 *   post:
 *     tags:
 *       - Categories
 *     summary: Create a new category (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, image]
 *             properties:
 *               name:
 *                 type: string
 *               image:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created successfully.
 */
router.post('/', category_controller_1.default.createCategory);
exports.default = router;
