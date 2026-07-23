import { Router } from 'express';
import searchController from '../controllers/search.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/search:
 *   get:
 *     tags:
 *       - Search
 *     summary: Global Unified Search
 *     description: Search for restaurants, specific meals (e.g. Jollof), or cuisines. Supports geospatial proximity.
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search keyword (Restaurant name or Food name)
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitude for nearby results
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: Longitude for nearby results
 *       - in: query
 *         name: cuisine
 *         schema:
 *           type: string
 *         description: Filter by specific cuisine type
 *     responses:
 *       200:
 *         description: Search results including matching restaurants and food items.
 */
router.get('/', searchController.globalSearch);

/**
 * @openapi
 * /api/v1/search/cuisines:
 *   get:
 *     tags:
 *       - Search
 *     summary: List popular Nigerian Cuisines
 *     responses:
 *       200:
 *         description: List of common cuisine types for filtering.
 */
router.get('/cuisines', searchController.getPopularCuisines);

/**
 * @openapi
 * /api/v1/search/top:
 *   get:
 *     tags:
 *       - Search
 *     summary: List top trending searches
 *     responses:
 *       200:
 *         description: List of top searches
 */
router.get('/top', searchController.getTopSearches);

export default router;
