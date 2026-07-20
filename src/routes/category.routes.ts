import { Router } from 'express';
import categoryController from '../controllers/category.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

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
router.get('/', categoryController.getAllCategories);

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
router.get('/:id', categoryController.getCategoryById);

// Protected Admin Routes
router.use(protect);
router.use(restrictTo(UserRole.ADMIN));

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
router.post('/', categoryController.createCategory);

export default router;
