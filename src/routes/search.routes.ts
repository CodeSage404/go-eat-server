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
 *     description: Search for restaurants, specific meals, or cuisines strictly filtered by active location or country.
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search keyword (Restaurant name or Food name)
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
 *     summary: List popular Cuisines by location
 *     parameters:
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
 *       - in: header
 *         name: x-country-code
 *         schema:
 *           type: string
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
 *     summary: List top trending searches by location
 *     parameters:
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
 *       - in: header
 *         name: x-country-code
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of top searches
 */
router.get('/top', searchController.getTopSearches);

export default router;
