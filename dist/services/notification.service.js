"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const logger_1 = __importDefault(require("../utils/logger"));
const user_model_1 = __importDefault(require("../models/user.model"));
const userNotification_model_1 = __importStar(require("../models/userNotification.model"));
const io_1 = require("../io");
const constants_1 = require("../types/constants");
// Initialize Firebase Admin with robust check for placeholder values
if (process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.FIREBASE_SERVICE_ACCOUNT.startsWith('your_')) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(serviceAccount),
        });
        logger_1.default.info('🔥 Firebase Admin initialized');
    }
    catch (error) {
        logger_1.default.warn('❌ Firebase initialization failed: Invalid JSON in FIREBASE_SERVICE_ACCOUNT environment variable.');
    }
}
else {
    logger_1.default.warn('⚠️ Firebase service account not configured or using placeholder. Push notifications will be disabled.');
}
class NotificationService {
    /**
     * Send notification via Socket.io + Push (FCM) + persist to DB
     */
    async sendNotification(userId, title, body, data = {}, type = userNotification_model_1.NotificationType.SYSTEM) {
        // 1. Persist to database for in-app inbox
        try {
            const notification = await userNotification_model_1.default.create({
                user: userId,
                title,
                body,
                type,
                orderId: data.orderId || undefined,
                data,
            });
            // 2. Send via Socket.io (Real-time in-app) — include the full doc so the client can render it
            (0, io_1.emitToUser)(userId, constants_1.SOCKET_EVENTS.NOTIFICATION, {
                _id: notification._id,
                title,
                body,
                type: notification.type,
                isRead: false,
                orderId: data.orderId,
                data,
                createdAt: notification.createdAt,
            });
        }
        catch (err) {
            logger_1.default.error('❌ Error persisting notification:', err);
            // Still try socket even if DB fails
            (0, io_1.emitToUser)(userId, constants_1.SOCKET_EVENTS.NOTIFICATION, {
                _id: new mongoose_1.default.Types.ObjectId().toString(),
                title,
                body,
                type: data.type || 'system',
                isRead: false,
                orderId: data.orderId,
                data,
                createdAt: new Date().toISOString(),
            });
        }
        // 3. Send via Push Notification (FCM)
        try {
            const user = await user_model_1.default.findById(userId);
            if (user && user.fcmToken && user.notificationsEnabled) {
                const message = {
                    notification: { title, body },
                    data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
                    token: user.fcmToken,
                };
                await firebase_admin_1.default.messaging().send(message);
                logger_1.default.info(`📲 Push notification sent to user: ${userId}`);
            }
        }
        catch (error) {
            logger_1.default.error('❌ Error sending push notification:', error);
        }
    }
    /**
     * Notify vendor/outlet about a new incoming order
     */
    async notifyNewOrder(userId, orderId) {
        await this.sendNotification(userId, constants_1.NOTIFICATION_MESSAGES.ORDER.NEW_VENDOR.TITLE, constants_1.NOTIFICATION_MESSAGES.ORDER.NEW_VENDOR.BODY, { orderId, type: 'NEW_ORDER' }, userNotification_model_1.NotificationType.NEW_ORDER);
    }
    /**
     * Notify customer about their order status change
     */
    async notifyOrderStatusUpdate(userId, orderId, message) {
        await this.sendNotification(userId, constants_1.NOTIFICATION_MESSAGES.ORDER.STATUS_UPDATE.TITLE, message, { orderId, type: 'ORDER_UPDATE' }, userNotification_model_1.NotificationType.ORDER_UPDATE);
    }
    /**
     * Notify vendor/outlet about an order status change on their outlet
     */
    async notifyVendorOrderUpdate(vendorUserId, orderId, status, statusMessage) {
        await this.sendNotification(vendorUserId, `Order Update`, statusMessage, { orderId, status, type: 'ORDER_UPDATE' }, userNotification_model_1.NotificationType.ORDER_UPDATE);
    }
    /**
     * Notify both customer and vendor that an order has been dispatched (rider picked up)
     */
    async notifyOrderDispatched(customerId, vendorUserId, orderId) {
        // Customer gets "Your order is on its way!"
        await this.sendNotification(customerId, constants_1.NOTIFICATION_MESSAGES.ORDER.RIDER_ASSIGNED.TITLE, 'Your order has been picked up and is on its way to you!', { orderId, status: 'out_for_delivery', type: 'ORDER_UPDATE' }, userNotification_model_1.NotificationType.ORDER_UPDATE);
        // Vendor gets "Order dispatched"
        await this.sendNotification(vendorUserId, 'Order Dispatched', `Order #${orderId.substring(0, 6)} has been picked up by the courier.`, { orderId, status: 'out_for_delivery', type: 'ORDER_UPDATE' }, userNotification_model_1.NotificationType.ORDER_UPDATE);
    }
    /**
     * Notify nearby riders about available deliveries
     */
    async notifyRiderAvailableOrder(riderId, orderId) {
        await this.sendNotification(riderId, constants_1.NOTIFICATION_MESSAGES.ORDER.RIDER_AVAILABLE.TITLE, constants_1.NOTIFICATION_MESSAGES.ORDER.RIDER_AVAILABLE.BODY, { orderId, type: 'RIDER_JOB' }, userNotification_model_1.NotificationType.NEW_ORDER);
    }
}
exports.default = new NotificationService();
