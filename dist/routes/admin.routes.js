"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = __importDefault(require("../controllers/admin.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
// Enforce auth & restrict all endpoints to platform Admins only
router.use(auth_middleware_1.protect);
router.use((0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN));
/**
 * @openapi
 * /api/v1/admin/platform-stats:
 *   get:
 *     tags:
 *       - Admin Dashboard
 *     summary: Retrieve platform wide operations & financial performance metrics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Operation statistics returned
 */
router.get('/platform-stats', admin_controller_1.default.getPlatformStats);
/**
 * @openapi
 * /api/v1/admin/users:
 *   get:
 *     tags:
 *       - Admin Dashboard
 *     summary: List all registered users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users returned
 */
router.get('/users', admin_controller_1.default.getAllUsers);
/**
 * @openapi
 * /api/v1/admin/users/{id}/status:
 *   patch:
 *     tags:
 *       - Admin Dashboard
 *     summary: Suspend or reactivate user accounts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, suspended]
 *     responses:
 *       200:
 *         description: Status updated
 */
router.post('/users/:id/status', admin_controller_1.default.updateUserStatus);
/**
 * @openapi
 * /api/v1/admin/restaurants:
 *   get:
 *     tags:
 *       - Admin Dashboard
 *     summary: Retrieve list of all restaurants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of restaurants returned
 */
router.get('/restaurants', admin_controller_1.default.getAllRestaurants);
/**
 * @openapi
 * /api/v1/admin/restaurants/{id}/status:
 *   patch:
 *     tags:
 *       - Admin Dashboard
 *     summary: Change status of a restaurant (Approve/Suspend)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, pending, suspended]
 *     responses:
 *       200:
 *         description: Restaurant status updated successfully
 */
router.post('/restaurants/:id/status', admin_controller_1.default.updateRestaurantStatus);
exports.default = router;
