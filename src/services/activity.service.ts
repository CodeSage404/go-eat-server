import User, { IUser, UserRole, UserStatus } from '../models/user.model';
import emailService from './email.service';
import notificationService from './notification.service';
import { NotificationType } from '../models/userNotification.model';
import logger from '../utils/logger';

export interface DeviceInfo {
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  userAgent?: string;
  ipAddress?: string;
}

class ActivityService {
  private cronTimer: NodeJS.Timeout | null = null;

  /**
   * Tracks user real-time activity and optionally updates device metadata.
   */
  public async trackUserActivity(userId: string, deviceInfo?: DeviceInfo): Promise<void> {
    try {
      const now = new Date();
      const updateData: Record<string, any> = {
        lastActiveAt: now,
      };

      if (deviceInfo && (deviceInfo.deviceId || deviceInfo.userAgent || deviceInfo.ipAddress)) {
        const user = await User.findById(userId);
        if (!user) return;

        const known = user.knownDevices || [];
        const existingDeviceIndex = known.findIndex(d => {
          if (deviceInfo.deviceId && d.deviceId) {
            return d.deviceId === deviceInfo.deviceId;
          }
          if (deviceInfo.userAgent && d.userAgent) {
            return d.userAgent === deviceInfo.userAgent;
          }
          return false;
        });

        if (existingDeviceIndex >= 0) {
          known[existingDeviceIndex].lastSeenAt = now;
          if (deviceInfo.ipAddress) known[existingDeviceIndex].ipAddress = deviceInfo.ipAddress;
          if (deviceInfo.deviceName) known[existingDeviceIndex].deviceName = deviceInfo.deviceName;
        } else {
          known.push({
            deviceId: deviceInfo.deviceId,
            deviceName: deviceInfo.deviceName || deviceInfo.platform || 'Mobile Device',
            platform: deviceInfo.platform,
            userAgent: deviceInfo.userAgent,
            ipAddress: deviceInfo.ipAddress,
            firstSeenAt: now,
            lastSeenAt: now,
          });
        }
        updateData.knownDevices = known;
      }

      await User.findByIdAndUpdate(userId, updateData);
    } catch (err: any) {
      logger.warn(`⚠️ Failed to update real-time user activity for ${userId}:`, err?.message || err);
    }
  }

  /**
   * Compares incoming device with the user's known devices.
   * Returns true if the device is unrecognized / new.
   */
  public isNewDevice(user: IUser, incomingDevice: DeviceInfo): boolean {
    const known = user.knownDevices || [];
    const lastDevice = user.lastLoginDevice;

    // If the user has never logged in before or has no device history recorded, treat as initial login (not an alert)
    if (!lastDevice && known.length === 0) {
      return false;
    }

    // Check against known devices list
    if (incomingDevice.deviceId) {
      const match = known.some(d => d.deviceId === incomingDevice.deviceId);
      if (match) return false;
      if (lastDevice?.deviceId && lastDevice.deviceId === incomingDevice.deviceId) return false;
    }

    if (incomingDevice.userAgent) {
      const match = known.some(d => d.userAgent && d.userAgent.trim() === incomingDevice.userAgent?.trim());
      if (match) return false;
      if (lastDevice?.userAgent && lastDevice.userAgent.trim() === incomingDevice.userAgent.trim()) return false;
    }

    return true;
  }

  /**
   * Scans for customers who have been inactive for >= 7 days and dispatches re-engagement notifications.
   */
  public async checkInactiveUsersAndNotify(): Promise<{ scannedCount: number; notifiedCount: number }> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    logger.info(`🔍 Running 7-day user inactivity scan (Threshold: ${sevenDaysAgo.toISOString()})...`);

    // Find verified, active customers whose last activity was >= 7 days ago
    // And who haven't received an inactivity alert within the last 14 days
    const query = {
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      isVerified: true,
      $and: [
        {
          $or: [
            { lastActiveAt: { $lt: sevenDaysAgo } },
            { lastActiveAt: { $exists: false }, lastLoginAt: { $lt: sevenDaysAgo } },
            { lastActiveAt: { $exists: false }, lastLoginAt: { $exists: false }, createdAt: { $lt: sevenDaysAgo } },
          ],
        },
        {
          $or: [
            { lastInactivityAlertAt: { $exists: false } },
            { lastInactivityAlertAt: null },
            { lastInactivityAlertAt: { $lt: fourteenDaysAgo } },
          ],
        },
      ],
    };

    const inactiveUsers = await User.find(query).limit(500);
    let notifiedCount = 0;

    for (const user of inactiveUsers) {
      try {
        const now = new Date();

        // 1. Send friendly re-engagement email if email is present
        if (user.email) {
          await emailService.sendInactivityReengagement(user.email, {
            name: user.name || 'Food Lover',
            actionUrl: 'https://goeatone.com',
          });
        }

        // 2. Dispatch push notification and in-app notification
        await notificationService.sendNotification(
          user._id.toString(),
          'We miss you! 🍽️',
          "Your favorite dishes are waiting! Discover what's fresh and cooking near you on Go-Eat today.",
          { action: 'EXPLORE_OUTLETS' },
          NotificationType.PROMOTION
        );

        // 3. Mark alert timestamp to enforce frequency cap
        user.lastInactivityAlertAt = now;
        await user.save();
        notifiedCount++;
      } catch (err: any) {
        logger.error(`❌ Failed to send inactivity notification to user ${user._id}:`, err?.message || err);
      }
    }

    logger.info(`✅ Inactivity scan completed: ${inactiveUsers.length} scanned, ${notifiedCount} re-engagement alerts sent.`);
    return {
      scannedCount: inactiveUsers.length,
      notifiedCount,
    };
  }

  /**
   * Starts the recurring daily inactivity scan background timer.
   */
  public startInactivityCron(intervalMs: number = 24 * 60 * 60 * 1000): void {
    if (this.cronTimer) {
      clearInterval(this.cronTimer);
    }

    logger.info(`⏰ User inactivity re-engagement background schedule active (every ${Math.round(intervalMs / (60 * 60 * 1000))} hours).`);

    // Initial check after 30 seconds to allow server boot to settle
    setTimeout(() => {
      this.checkInactiveUsersAndNotify().catch(err =>
        logger.error('Error during initial inactivity scan:', err?.message || err)
      );
    }, 30000);

    // Recurring interval
    this.cronTimer = setInterval(() => {
      this.checkInactiveUsersAndNotify().catch(err =>
        logger.error('Error during recurring inactivity scan:', err?.message || err)
      );
    }, intervalMs);
  }

  public stopInactivityCron(): void {
    if (this.cronTimer) {
      clearInterval(this.cronTimer);
      this.cronTimer = null;
    }
  }
}

export default new ActivityService();
