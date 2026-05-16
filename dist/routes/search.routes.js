"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const search_controller_1 = __importDefault(require("../controllers/search.controller"));
const router = (0, express_1.Router)();
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
router.get('/', search_controller_1.default.globalSearch);
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
router.get('/cuisines', search_controller_1.default.getPopularCuisines);
exports.default = router;
