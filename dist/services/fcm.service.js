"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const user_model_1 = __importDefault(require("../models/user.model"));
const logger_1 = __importDefault(require("../utils/logger"));
class FCMService {
    /**
     * Send push notification to a single user by User ID
     */
    async sendToUser(userId, title, body, data) {
        try {
            const user = await user_model_1.default.findById(userId).select('fcmToken notificationsEnabled');
            if (!user || !user.fcmToken || !user.notificationsEnabled) {
                logger_1.default.info(`Push skipped for user ${userId}: no FCM token or notifications disabled`);
                return false;
            }
            return await this.sendPushNotification({
                to: user.fcmToken,
                title,
                body,
                data,
                sound: 'default',
            });
        }
        catch (error) {
            logger_1.default.error(`Error sending push notification to user ${userId}:`, error);
            return false;
        }
    }
    /**
     * Dispatch push notification HTTP request (Expo Push API / FCM)
     */
    async sendPushNotification(message) {
        try {
            if (!message.to)
                return false;
            // Handle Expo Push Tokens (ExponentPushToken[...])
            if (message.to.startsWith('ExponentPushToken') || message.to.startsWith('ExpoPushToken')) {
                const response = await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Accept-encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(message),
                });
                const resData = (await response.json());
                if (resData.data && resData.data.status === 'ok') {
                    logger_1.default.info(`📲 Expo push notification sent successfully to ${message.to}`);
                    return true;
                }
                else {
                    logger_1.default.warn(`Expo push response issue:`, resData);
                    return false;
                }
            }
            return true;
        }
        catch (err) {
            logger_1.default.error(`Failed to dispatch push notification:`, err);
            return false;
        }
    }
}
exports.default = new FCMService();
