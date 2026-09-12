"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const activity_service_1 = __importDefault(require("../services/activity.service"));
const catchAsync_1 = require("../utils/catchAsync");
const router = (0, express_1.Router)();
/**
 * @openapi
 * /api/v1/activity/ping:
 *   post:
 *     tags:
 *       - Activity
 *     summary: Real-time user heartbeat and activity tracking
 *     description: Updates the authenticated user's lastActiveAt timestamp and registers their active device.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Unique hardware/app installation identifier
 *               deviceName:
 *                 type: string
 *                 description: Name or model of the device (e.g. iPhone 15 Pro, Samsung S24)
 *               platform:
 *                 type: string
 *                 description: Operating system or platform (e.g. ios, android, web)
 *     responses:
 *       200:
 *         description: Activity recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Activity recorded
 */
router.post('/ping', auth_middleware_1.protect, (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    const { deviceId, deviceName, platform } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const rawIp = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || '';
    const ipAddress = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '';
    await activity_service_1.default.trackUserActivity(user._id.toString(), {
        deviceId,
        deviceName,
        platform,
        userAgent,
        ipAddress,
    });
    res.status(200).json({
        status: 'success',
        message: 'Activity recorded',
        data: {
            lastActiveAt: new Date(),
        },
    });
}));
/**
 * @openapi
 * /api/v1/activity/inactivity-scan:
 *   post:
 *     tags:
 *       - Activity
 *     summary: Trigger manual 7-day user inactivity re-engagement scan
 *     description: Scans for active customers who have not interacted with Go-Eat for 7+ days and dispatches re-engagement emails and push notifications.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inactivity scan executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     scannedCount:
 *                       type: integer
 *                       example: 45
 *                     notifiedCount:
 *                       type: integer
 *                       example: 12
 *       403:
 *         description: Forbidden - Admin permission required
 */
router.post('/inactivity-scan', auth_middleware_1.protect, (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN), (0, catchAsync_1.catchAsync)(async (req, res) => {
    const result = await activity_service_1.default.checkInactiveUsersAndNotify();
    res.status(200).json({
        status: 'success',
        message: 'Inactivity scan executed successfully',
        data: result,
    });
}));
exports.default = router;
