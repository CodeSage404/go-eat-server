"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const userNotification_model_1 = __importDefault(require("../models/userNotification.model"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
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
            const notification = await userNotification_model_1.default.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isRead: true }, { new: true });
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
    }
}
exports.default = new NotificationController();
