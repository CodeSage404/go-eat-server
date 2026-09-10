"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const userNotification_model_1 = __importDefault(require("../models/userNotification.model"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const user_model_1 = __importDefault(require("../models/user.model"));
const notification_service_1 = __importDefault(require("../services/notification.service"));
class NotificationController {
    constructor() {
        /**
         * @openapi
         * /api/v1/notifications:
         *   get:
         *     tags:
         *       - Notifications
         *     summary: Get logged-in user's notifications
         *     description: Returns all notifications for the authenticated user, sorted newest first. Supports pagination via page/limit query params.
         *     security:
         *       - bearerAuth: []
         *     parameters:
         *       - in: query
         *         name: page
         *         schema:
         *           type: integer
         *           default: 1
         *         description: Page number
         *       - in: query
         *         name: limit
         *         schema:
         *           type: integer
         *           default: 50
         *         description: Notifications per page
         *     responses:
         *       200:
         *         description: List of notifications
         */
        this.getMyNotifications = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const skip = (page - 1) * limit;
            const notifications = await userNotification_model_1.default.find({ user: req.user._id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);
            const total = await userNotification_model_1.default.countDocuments({ user: req.user._id });
            const unreadCount = await userNotification_model_1.default.countDocuments({ user: req.user._id, isRead: false });
            res.status(200).json({
                status: 'success',
                results: notifications.length,
                data: {
                    notifications,
                    unreadCount,
                    total,
                    page,
                    totalPages: Math.ceil(total / limit),
                },
            });
        });
        /**
         * @openapi
         * /api/v1/notifications/{id}/read:
         *   patch:
         *     tags:
         *       - Notifications
         *     summary: Mark a single notification as read
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
         *       404:
         *         description: Notification not found
         */
        this.markAsRead = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const notification = await userNotification_model_1.default.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isRead: true }, { returnDocument: 'after' });
            if (!notification) {
                throw new appError_1.default('Notification not found', 404);
            }
            res.status(200).json({
                status: 'success',
                data: { notification },
            });
        });
        /**
         * @openapi
         * /api/v1/notifications/read-all:
         *   patch:
         *     tags:
         *       - Notifications
         *     summary: Mark all notifications as read for the logged-in user
         *     security:
         *       - bearerAuth: []
         *     responses:
         *       200:
         *         description: All notifications marked as read
         */
        this.markAllAsRead = (0, catchAsync_1.catchAsync)(async (req, res) => {
            await userNotification_model_1.default.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
            res.status(200).json({
                status: 'success',
                message: 'All notifications marked as read',
            });
        });
        /**
         * @openapi
         * /api/v1/notifications/{id}:
         *   delete:
         *     tags:
         *       - Notifications
         *     summary: Delete a single notification
         *     description: Deletes an in-app notification by ID. Only the notification owner (customer, partner/vendor, or rider) can delete their own notifications.
         *     security:
         *       - bearerAuth: []
         *     parameters:
         *       - in: path
         *         name: id
         *         required: true
         *         schema:
         *           type: string
         *         description: The notification ID
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
         *         description: Invalid notification ID format
         *       401:
         *         description: Unauthorized - Authentication required
         *       404:
         *         description: Notification not found
         *       500:
         *         description: Internal server error
         */
        this.deleteNotification = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
            if (!id || !mongoose_1.default.Types.ObjectId.isValid(id)) {
                throw new appError_1.default('Invalid notification ID format', 400);
            }
            const notification = await userNotification_model_1.default.findOneAndDelete({
                _id: id,
                user: req.user._id,
            });
            if (!notification) {
                throw new appError_1.default('Notification not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: 'Notification deleted successfully',
                data: null,
            });
        });
        /**
         * @openapi
         * /api/v1/notifications/clear-all:
         *   delete:
         *     tags:
         *       - Notifications
         *     summary: Delete all notifications for the authenticated user
         *     description: Permanently removes all in-app notifications for the logged-in user, partner, or rider.
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
         *                       example: 12
         *       401:
         *         description: Unauthorized - Authentication required
         *       500:
         *         description: Internal server error
         */
        this.clearAllNotifications = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const result = await userNotification_model_1.default.deleteMany({
                user: req.user._id,
            });
            res.status(200).json({
                status: 'success',
                message: 'All notifications cleared successfully',
                data: {
                    deletedCount: result.deletedCount,
                },
            });
        });
        /**
         * @openapi
         * /api/v1/notifications/bulk-delete:
         *   post:
         *     tags:
         *       - Notifications
         *     summary: Delete multiple notifications by ID
         *     description: Deletes a list of in-app notifications specified by their IDs. Only notifications owned by the authenticated user are deleted.
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
         *                 description: Array of notification IDs to delete
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
         *         description: Invalid request body or empty IDs array
         *       401:
         *         description: Unauthorized - Authentication required
         *       500:
         *         description: Internal server error
         */
        this.deleteBulkNotifications = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.length === 0) {
                throw new appError_1.default('Please provide an array of notification IDs to delete', 400);
            }
            const validIds = ids.filter((id) => mongoose_1.default.Types.ObjectId.isValid(id));
            if (validIds.length === 0) {
                throw new appError_1.default('No valid notification IDs provided', 400);
            }
            const result = await userNotification_model_1.default.deleteMany({
                _id: { $in: validIds },
                user: req.user._id,
            });
            res.status(200).json({
                status: 'success',
                message: 'Notifications deleted successfully',
                data: {
                    deletedCount: result.deletedCount,
                },
            });
        });
        /**
         * @openapi
         * /api/v1/notifications/test-push:
         *   post:
         *     tags:
         *       - Notifications
         *     summary: Send a test push notification to a user by email
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
         *                 example: Go-Eat Test Notification
         *               body:
         *                 type: string
         *                 example: This is a test push notification
         *     responses:
         *       200:
         *         description: Test notification dispatched
         *       404:
         *         description: User not found
         */
        this.sendTestPush = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { email, title, body } = req.body;
            const targetEmail = (email || req.user?.email || '').toLowerCase();
            const user = await user_model_1.default.findOne({ email: targetEmail });
            if (!user) {
                throw new appError_1.default(`User with email ${targetEmail} not found`, 404);
            }
            await notification_service_1.default.sendNotification(user._id.toString(), title || 'Go-Eat Push Notification Test 🍔', body || 'Hello! Your push notification service is working properly.', { type: 'TEST', timestamp: new Date().toISOString() });
            res.status(200).json({
                status: 'success',
                message: `Test notification dispatched to ${targetEmail}`,
                data: {
                    userId: user._id,
                    email: user.email,
                    fcmToken: user.fcmToken ? `${user.fcmToken.substring(0, 15)}...` : null,
                    notificationsEnabled: user.notificationsEnabled,
                },
            });
        });
    }
}
exports.default = new NotificationController();
