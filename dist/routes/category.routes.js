"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const category_controller_1 = __importDefault(require("../controllers/category.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const upload_1 = require("../utils/upload");
const router = (0, express_1.Router)();
/**
 * @openapi
 * /api/v1/categories:
 *   get:
 *     tags:
 *       - Categories
 *     summary: Get all food categories
 *     description: Returns a list of all food & cravings categories filtered by user location / country, or scoped to a specific restaurant outlet.
 *     parameters:
 *       - in: query
 *         name: restaurant
 *         schema:
 *           type: string
 *         description: Restaurant ID to retrieve custom outlet categories or combined options
 *       - in: query
 *         name: onlyMine
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: When set to 'true' with restaurant ID, returns ONLY categories created by that outlet
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
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: Country name filter
 *       - in: query
 *         name: countryCode
 *         schema:
 *           type: string
 *         description: 2-letter ISO country code
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
 *     responses:
 *       200:
 *         description: Category details.
 *       404:
 *         description: Category not found.
 */
router.get('/:id', category_controller_1.default.getCategoryById);
// Protected Routes
router.use(auth_middleware_1.protect);
/**
 * @openapi
 * /api/v1/categories:
 *   post:
 *     tags:
 *       - Categories
 *     summary: Create a new category (Admin/Vendor)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name, image]
 *             properties:
 *               name:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created successfully.
 */
router.post('/', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN, user_model_1.UserRole.VENDOR), upload_1.upload.single('image'), category_controller_1.default.createCategory);
/**
 * @openapi
 * /api/v1/categories/{id}:
 *   patch:
 *     tags:
 *       - Categories
 *     summary: Update a category (Admin/Vendor)
 *     description: Update an existing category details or image. Allowed for Administrators and Vendors.
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Category updated successfully.
 *       403:
 *         description: Forbidden - Vendors can only edit categories created by their outlet.
 *       404:
 *         description: Category not found.
 */
router.patch('/:id', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN, user_model_1.UserRole.VENDOR), upload_1.upload.single('image'), category_controller_1.default.updateCategory);
/**
 * @openapi
 * /api/v1/categories/{id}:
 *   put:
 *     tags:
 *       - Categories
 *     summary: Update a category (Admin/Vendor)
 *     description: Full update of an existing category. Allowed for Administrators and Vendors.
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Category updated successfully.
 *       403:
 *         description: Forbidden - Vendors can only edit categories created by their outlet.
 *       404:
 *         description: Category not found.
 */
router.put('/:id', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN, user_model_1.UserRole.VENDOR), upload_1.upload.single('image'), category_controller_1.default.updateCategory);
/**
 * @openapi
 * /api/v1/categories/{id}:
 *   delete:
 *     tags:
 *       - Categories
 *     summary: Delete a category (Admin/Vendor)
 *     description: Remove a category by ID. Allowed for Administrators and Vendors.
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
 *         description: Category deleted successfully.
 *       403:
 *         description: Forbidden - Vendors can only delete categories created by their outlet.
 *       404:
 *         description: Category not found.
 */
router.delete('/:id', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN, user_model_1.UserRole.VENDOR), category_controller_1.default.deleteCategory);
exports.default = router;
