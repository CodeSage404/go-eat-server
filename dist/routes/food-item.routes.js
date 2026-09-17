"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const menu_controller_1 = __importDefault(require("../controllers/menu.controller"));
const router = (0, express_1.Router)();
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
router.get('/', menu_controller_1.default.getAllFoodItems);
exports.default = router;
