"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_1 = __importDefault(require("../controllers/notification.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// All notification routes require authentication
router.use(auth_middleware_1.protect);
/**
 * @openapi
 * /api/v1/notifications:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: Get my notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user notifications
 */
router.get('/', notification_controller_1.default.getMyNotifications);
/**
 * @openapi
 * /api/v1/notifications/read-all:
 *   patch:
 *     tags:
 *       - Notifications
 *     summary: Mark all notifications as read
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.patch('/read-all', notification_controller_1.default.markAllAsRead);
/**
 * @openapi
 * /api/v1/notifications/{id}/read:
 *   patch:
 *     tags:
 *       - Notifications
 *     summary: Mark a notification as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.patch('/:id/read', notification_controller_1.default.markAsRead);
/**
 * @openapi
 * /api/v1/notifications/clear-all:
 *   delete:
 *     tags:
 *       - Notifications
 *     summary: Delete all notifications for the authenticated user
 *     description: Permanently deletes all in-app notifications for the authenticated user, partner, or rider.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications cleared successfully
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
 *                   example: All notifications cleared successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCount:
 *                       type: integer
 *                       example: 8
 *       401:
 *         description: Unauthorized - Authentication token is missing or invalid
 *       500:
 *         description: Internal server error
 */
router.delete('/clear-all', notification_controller_1.default.clearAllNotifications);
/**
 * @openapi
 * /api/v1/notifications/bulk-delete:
 *   post:
 *     tags:
 *       - Notifications
 *     summary: Delete multiple notifications by ID
 *     description: Deletes an array of in-app notifications matching the provided IDs for the authenticated user, partner, or rider.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of notification ObjectId strings to delete
 *                 example: ["65f123456789abcdef012345", "65f123456789abcdef012346"]
 *     responses:
 *       200:
 *         description: Notifications deleted successfully
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
 *                   example: Notifications deleted successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCount:
 *                       type: integer
 *                       example: 2
 *       400:
 *         description: Bad request - Missing or invalid notification IDs array
 *       401:
 *         description: Unauthorized - Authentication token is missing or invalid
 *       500:
 *         description: Internal server error
 */
router.post('/bulk-delete', notification_controller_1.default.deleteBulkNotifications);
/**
 * @openapi
 * /api/v1/notifications/bulk:
 *   delete:
 *     tags:
 *       - Notifications
 *     summary: Delete multiple notifications by ID via DELETE method
 *     description: Deletes an array of in-app notifications matching the provided IDs for the authenticated user, partner, or rider.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of notification ObjectId strings to delete
 *                 example: ["65f123456789abcdef012345", "65f123456789abcdef012346"]
 *     responses:
 *       200:
 *         description: Notifications deleted successfully
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
 *                   example: Notifications deleted successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCount:
 *                       type: integer
 *                       example: 2
 *       400:
 *         description: Bad request - Missing or invalid notification IDs array
 *       401:
 *         description: Unauthorized - Authentication token is missing or invalid
 *       500:
 *         description: Internal server error
 */
router.delete('/bulk', notification_controller_1.default.deleteBulkNotifications);
/**
 * @openapi
 * /api/v1/notifications/{id}:
 *   delete:
 *     tags:
 *       - Notifications
 *     summary: Delete a single notification by ID
 *     description: Permanently deletes a specific in-app notification owned by the authenticated user, partner, or rider.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ObjectId
 *         example: 65f123456789abcdef012345
 *     responses:
 *       200:
 *         description: Notification deleted successfully
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
 *                   example: Notification deleted successfully
 *                 data:
 *                   type: "null"
 *       400:
 *         description: Bad request - Invalid notification ID format
 *       401:
 *         description: Unauthorized - Authentication token is missing or invalid
 *       404:
 *         description: Notification not found or not owned by user
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', notification_controller_1.default.deleteNotification);
/**
 * @openapi
 * /api/v1/notifications:
 *   delete:
 *     tags:
 *       - Notifications
 *     summary: Clear all notifications for user
 *     description: Deletes all in-app notifications for the authenticated user, partner, or rider.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications cleared successfully
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
 *                   example: All notifications cleared successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCount:
 *                       type: integer
 *                       example: 5
 *       401:
 *         description: Unauthorized - Authentication token is missing or invalid
 *       500:
 *         description: Internal server error
 */
router.delete('/', notification_controller_1.default.clearAllNotifications);
/**
 * @openapi
 * /api/v1/notifications/test-push:
 *   post:
 *     tags:
 *       - Notifications
 *     summary: Send a test push notification to a user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: echinecherem729@gmail.com
 *               title:
 *                 type: string
 *                 example: Go-Eat Push Notification Test
 *               body:
 *                 type: string
 *                 example: Hello! Your push notification service is working properly.
 *     responses:
 *       200:
 *         description: Test notification dispatched
 */
router.post('/test-push', notification_controller_1.default.sendTestPush);
exports.default = router;
