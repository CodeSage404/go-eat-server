import admin from 'firebase-admin';
import logger from '../utils/logger';
import User from '../models/user.model';
import { emitToUser } from '../io';
import { NOTIFICATION_MESSAGES, SOCKET_EVENTS } from '../types/constants';

// Initialize Firebase Admin with robust check for placeholder values
if (process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.FIREBASE_SERVICE_ACCOUNT.startsWith('your_')) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    logger.info('🔥 Firebase Admin initialized');
  } catch (error) {
    logger.warn('❌ Firebase initialization failed: Invalid JSON in FIREBASE_SERVICE_ACCOUNT environment variable.');
  }
} else {
  logger.warn('⚠️ Firebase service account not configured or using placeholder. Push notifications will be disabled.');
}

class NotificationService {
  /**
   * Send notification via both Socket.io and Push Notification (FCM)
   */
  async sendNotification(userId: string, title: string, body: string, data: any = {}) {
    // Send via Socket.io (Real-time in-app)
    emitToUser(userId, SOCKET_EVENTS.NOTIFICATION, { title, body, data });

    // Send via Push Notification (FCM)
    try {
      const user = await User.findById(userId);
      if (user && user.fcmToken && user.notificationsEnabled) {
        const message = {
          notification: { title, body },
          data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
          token: user.fcmToken,
        };

        await admin.messaging().send(message);
        logger.info(`📲 Push notification sent to user: ${userId}`);
      }
    } catch (error) {
      logger.error('❌ Error sending push notification:', error);
    }
  }

  /**
   * Specialized notification for new orders
   */
  async notifyNewOrder(userId: string, orderId: string) {
    await this.sendNotification(
      userId,
      NOTIFICATION_MESSAGES.ORDER.NEW_VENDOR.TITLE,
      NOTIFICATION_MESSAGES.ORDER.NEW_VENDOR.BODY,
      { orderId, type: 'NEW_ORDER' }
    );
  }

  /**
   * Specialized notification for order status updates
   */
  async notifyOrderStatusUpdate(userId: string, orderId: string, status: string) {
    await this.sendNotification(
      userId,
      NOTIFICATION_MESSAGES.ORDER.STATUS_UPDATE.TITLE,
      NOTIFICATION_MESSAGES.ORDER.STATUS_UPDATE.BODY(orderId, status),
      { orderId, status, type: 'ORDER_UPDATE' }
    );
  }

  /**
   * Notify nearby riders about available deliveries
   */
  async notifyRiderAvailableOrder(riderId: string, orderId: string) {
    await this.sendNotification(
      riderId,
      NOTIFICATION_MESSAGES.ORDER.RIDER_AVAILABLE.TITLE,
      NOTIFICATION_MESSAGES.ORDER.RIDER_AVAILABLE.BODY,
      { orderId, type: 'RIDER_JOB' }
    );
  }
}

export default new NotificationService();
