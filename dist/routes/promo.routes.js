"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const promo_controller_1 = __importDefault(require("../controllers/promo.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.protect);
/**
 * @openapi
 * /api/v1/promos/apply:
 *   post:
 *     tags:
 *       - Promotions
 *     summary: Apply a promo code to an order
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, orderAmount]
 *             properties:
 *               code:
 *                 type: string
 *               orderAmount:
 *                 type: number
 *               restaurantId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Promo applied, returns discount amount
 */
router.post('/apply', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.CUSTOMER), promo_controller_1.default.applyPromo);
/**
 * @openapi
 * /api/v1/promos:
 *   post:
 *     tags:
 *       - Promotions
 *     summary: Create a new promotion
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, discountPercentage, expiryDate]
 *             properties:
 *               code:
 *                 type: string
 *               discountPercentage:
 *                 type: number
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Promo created
 */
router.post('/', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN, user_model_1.UserRole.VENDOR), promo_controller_1.default.createPromo);
exports.default = router;
