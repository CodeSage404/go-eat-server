"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_controller_1 = __importDefault(require("../controllers/analytics.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.protect);
/**
 * @openapi
 * /api/v1/analytics/vendor:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get vendor dashboard statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Revenue, total orders, and top-selling items.
 */
router.get('/vendor', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), analytics_controller_1.default.getVendorAnalytics);
/**
 * @openapi
 * /api/v1/analytics/rider:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get rider earnings and statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Total deliveries and earnings.
 */
router.get('/rider', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER), analytics_controller_1.default.getRiderAnalytics);
exports.default = router;
