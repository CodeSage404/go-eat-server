import { Router } from 'express';
import menuController from '../controllers/menu.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/food-items:
 *   get:
 *     tags:
 *       - Food Items
 *     summary: Get all food items across restaurants or filtered by category/restaurant/country
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
