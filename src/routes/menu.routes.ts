import { Router } from 'express';
import menuController from '../controllers/menu.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';
import { upload } from '../utils/upload';

const router = Router({ mergeParams: true }); // Enable merging params from parent router

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
router.get('/', menuController.getMenu);

// Protected routes (Vendor/Admin only)
router.use(protect);
router.use(restrictTo(UserRole.VENDOR, UserRole.ADMIN));

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
router.post('/categories', menuController.createCategory);

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
router.post('/items', upload.single('image'), menuController.addFoodItem);

/**
 * @openapi
 * /api/v1/restaurants/{restaurantId}/menu/items/{id}:
 *   patch:
 *     tags:
 *       - Menu
 *     summary: Update a food item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
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
 *               price:
 *                 type: number
 *               isAvailable:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Food item updated successfully
 */
router.patch('/items/:id', menuController.updateFoodItem);
/**
 * @openapi
 * /api/v1/restaurants/{restaurantId}/menu/items/{id}:
 *   delete:
 *     tags:
 *       - Menu
 *     summary: Delete a food item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Food item deleted
 */
router.delete('/items/:id', menuController.deleteFoodItem);

export default router;
