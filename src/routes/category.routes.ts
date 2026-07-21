import { Router } from 'express';
import categoryController from '../controllers/category.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';
import { upload } from '../utils/upload';

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
router.post('/', upload.single('image'), categoryController.createCategory);

/**
 * @openapi
 * /api/v1/categories/{id}:
 *   patch:
 *     tags:
 *       - Categories
 *     summary: Update a category (Admin only)
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
 */
router.patch('/:id', upload.single('image'), categoryController.updateCategory);
router.put('/:id', upload.single('image'), categoryController.updateCategory);

/**
 * @openapi
 * /api/v1/categories/{id}:
 *   delete:
 *     tags:
 *       - Categories
 *     summary: Delete a category (Admin only)
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
 */
router.delete('/:id', categoryController.deleteCategory);

export default router;
