import { Router } from 'express';
import menuController from '../controllers/menu.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/food-items:
 *   get:
 *     tags:
 *       - Food Items
 *     summary: Get all food items across restaurants or filtered by category/restaurant
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Category ID or name
 *       - in: query
 *         name: restaurant
 *         schema:
 *           type: string
 *         description: Restaurant ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Keyword search
 *     responses:
 *       200:
 *         description: List of matching food items
 */
router.get('/', menuController.getAllFoodItems);

export default router;
