import User from '../models/user.model';
import logger from '../utils/logger';

interface PushMessagePayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
}

class FCMService {
  /**
   * Send push notification to a single user by User ID
   */
  public async sendToUser(userId: string, title: string, body: string, data?: Record<string, any>): Promise<boolean> {
    try {
      const user = await User.findById(userId).select('fcmToken notificationsEnabled');
      if (!user || !user.fcmToken || !user.notificationsEnabled) {
        logger.info(`Push skipped for user ${userId}: no FCM token or notifications disabled`);
        return false;
      }

      return await this.sendPushNotification({
        to: user.fcmToken,
        title,
        body,
        data,
        sound: 'default',
      });
    } catch (error) {
      logger.error(`Error sending push notification to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Dispatch push notification HTTP request (Expo Push API / FCM)
   */
  public async sendPushNotification(message: PushMessagePayload): Promise<boolean> {
    try {
      if (!message.to) return false;

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

        const resData = (await response.json()) as any;
        if (resData.data && resData.data.status === 'ok') {
          logger.info(`📲 Expo push notification sent successfully to ${message.to}`);
          return true;
        } else {
          logger.warn(`Expo push response issue:`, resData);
          return false;
        }
      }

      return true;
    } catch (err) {
      logger.error(`Failed to dispatch push notification:`, err);
      return false;
    }
  }
}

export default new FCMService();
