"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const logger_1 = __importDefault(require("../utils/logger"));
const user_model_1 = __importDefault(require("../models/user.model"));
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
     * Send notification via both Socket.io and Push Notification (FCM)
     */
    async sendNotification(userId, title, body, data = {}) {
        // Send via Socket.io (Real-time in-app)
        (0, io_1.emitToUser)(userId, constants_1.SOCKET_EVENTS.NOTIFICATION, { title, body, data });
        // Send via Push Notification (FCM)
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
     * Specialized notification for new orders
     */
    async notifyNewOrder(userId, orderId) {
        await this.sendNotification(userId, constants_1.NOTIFICATION_MESSAGES.ORDER.NEW_VENDOR.TITLE, constants_1.NOTIFICATION_MESSAGES.ORDER.NEW_VENDOR.BODY, { orderId, type: 'NEW_ORDER' });
    }
    /**
     * Specialized notification for order status updates
     */
    async notifyOrderStatusUpdate(userId, orderId, status) {
        await this.sendNotification(userId, constants_1.NOTIFICATION_MESSAGES.ORDER.STATUS_UPDATE.TITLE, constants_1.NOTIFICATION_MESSAGES.ORDER.STATUS_UPDATE.BODY(orderId, status), { orderId, status, type: 'ORDER_UPDATE' });
    }
    /**
     * Notify nearby riders about available deliveries
     */
    async notifyRiderAvailableOrder(riderId, orderId) {
        await this.sendNotification(riderId, constants_1.NOTIFICATION_MESSAGES.ORDER.RIDER_AVAILABLE.TITLE, constants_1.NOTIFICATION_MESSAGES.ORDER.RIDER_AVAILABLE.BODY, { orderId, type: 'RIDER_JOB' });
    }
}
exports.default = new NotificationService();
