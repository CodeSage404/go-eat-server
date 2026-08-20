import mongoose from 'mongoose';
import admin from 'firebase-admin';
import logger from '../utils/logger';
import User from '../models/user.model';
import UserNotification, { NotificationType } from '../models/userNotification.model';
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
   * Send notification via Socket.io + Push (FCM) + persist to DB
   */
  async sendNotification(
    userId: string,
    title: string,
    body: string,
    data: any = {},
    type: NotificationType = NotificationType.SYSTEM
  ) {
    // 1. Persist to database for in-app inbox
    try {
      const notification = await UserNotification.create({
        user: userId,
        title,
        body,
        type,
        orderId: data.orderId || undefined,
        data,
      });

      // 2. Send via Socket.io (Real-time in-app) — include the full doc so the client can render it
      emitToUser(userId, SOCKET_EVENTS.NOTIFICATION, {
        _id: notification._id,
        title,
        body,
        type: notification.type,
        isRead: false,
        orderId: data.orderId,
        data,
        createdAt: notification.createdAt,
      });
    } catch (err) {
      logger.error('❌ Error persisting notification:', err);
      // Still try socket even if DB fails
      emitToUser(userId, SOCKET_EVENTS.NOTIFICATION, {
        _id: new mongoose.Types.ObjectId().toString(),
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
   * Notify vendor/outlet about a new incoming order
   */
  async notifyNewOrder(userId: string, orderId: string) {
    await this.sendNotification(
      userId,
      NOTIFICATION_MESSAGES.ORDER.NEW_VENDOR.TITLE,
      NOTIFICATION_MESSAGES.ORDER.NEW_VENDOR.BODY,
      { orderId, type: 'NEW_ORDER' },
      NotificationType.NEW_ORDER
    );
  }

  /**
   * Notify customer about their order status change
   */
  async notifyOrderStatusUpdate(userId: string, orderId: string, message: string) {
    await this.sendNotification(
      userId,
      NOTIFICATION_MESSAGES.ORDER.STATUS_UPDATE.TITLE,
      message,
      { orderId, type: 'ORDER_UPDATE' },
      NotificationType.ORDER_UPDATE
    );
  }

  /**
   * Notify vendor/outlet about an order status change on their outlet
   */
  async notifyVendorOrderUpdate(vendorUserId: string, orderId: string, status: string, statusMessage: string) {
    await this.sendNotification(
      vendorUserId,
      `Order Update`,
      statusMessage,
      { orderId, status, type: 'ORDER_UPDATE' },
      NotificationType.ORDER_UPDATE
    );
  }

  /**
   * Notify both customer and vendor that an order has been dispatched (rider picked up)
   */
  async notifyOrderDispatched(customerId: string, vendorUserId: string, orderId: string) {
    // Customer gets "Your order is on its way!"
    await this.sendNotification(
      customerId,
      NOTIFICATION_MESSAGES.ORDER.RIDER_ASSIGNED.TITLE,
      'Your order has been picked up and is on its way to you!',
      { orderId, status: 'out_for_delivery', type: 'ORDER_UPDATE' },
      NotificationType.ORDER_UPDATE
    );

    // Vendor gets "Order dispatched"
    await this.sendNotification(
      vendorUserId,
      'Order Dispatched',
      `Order #${orderId.substring(0, 6)} has been picked up by the courier.`,
      { orderId, status: 'out_for_delivery', type: 'ORDER_UPDATE' },
      NotificationType.ORDER_UPDATE
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
      { orderId, type: 'RIDER_JOB' },
      NotificationType.NEW_ORDER
    );
  }
}

export default new NotificationService();
