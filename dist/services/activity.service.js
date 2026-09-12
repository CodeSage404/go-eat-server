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
const user_model_1 = __importStar(require("../models/user.model"));
const email_service_1 = __importDefault(require("./email.service"));
const notification_service_1 = __importDefault(require("./notification.service"));
const userNotification_model_1 = require("../models/userNotification.model");
const logger_1 = __importDefault(require("../utils/logger"));
class ActivityService {
    constructor() {
        this.cronTimer = null;
    }
    /**
     * Tracks user real-time activity and optionally updates device metadata.
     */
    async trackUserActivity(userId, deviceInfo) {
        try {
            const now = new Date();
            const updateData = {
                lastActiveAt: now,
            };
            if (deviceInfo && (deviceInfo.deviceId || deviceInfo.userAgent || deviceInfo.ipAddress)) {
                const user = await user_model_1.default.findById(userId);
                if (!user)
                    return;
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
                    if (deviceInfo.ipAddress)
                        known[existingDeviceIndex].ipAddress = deviceInfo.ipAddress;
                    if (deviceInfo.deviceName)
                        known[existingDeviceIndex].deviceName = deviceInfo.deviceName;
                }
                else {
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
            await user_model_1.default.findByIdAndUpdate(userId, updateData);
        }
        catch (err) {
            logger_1.default.warn(`⚠️ Failed to update real-time user activity for ${userId}:`, err?.message || err);
        }
    }
    /**
     * Compares incoming device with the user's known devices.
     * Returns true if the device is unrecognized / new.
     */
    isNewDevice(user, incomingDevice) {
        const known = user.knownDevices || [];
        const lastDevice = user.lastLoginDevice;
        // If the user has never logged in before or has no device history recorded, treat as initial login (not an alert)
        if (!lastDevice && known.length === 0) {
            return false;
        }
        // Check against known devices list
        if (incomingDevice.deviceId) {
            const match = known.some(d => d.deviceId === incomingDevice.deviceId);
            if (match)
                return false;
            if (lastDevice?.deviceId && lastDevice.deviceId === incomingDevice.deviceId)
                return false;
        }
        if (incomingDevice.userAgent) {
            const match = known.some(d => d.userAgent && d.userAgent.trim() === incomingDevice.userAgent?.trim());
            if (match)
                return false;
            if (lastDevice?.userAgent && lastDevice.userAgent.trim() === incomingDevice.userAgent.trim())
                return false;
        }
        return true;
    }
    /**
     * Scans for customers who have been inactive for >= 7 days and dispatches re-engagement notifications.
     */
    async checkInactiveUsersAndNotify() {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        logger_1.default.info(`🔍 Running 7-day user inactivity scan (Threshold: ${sevenDaysAgo.toISOString()})...`);
        // Find verified, active customers whose last activity was >= 7 days ago
        // And who haven't received an inactivity alert within the last 14 days
        const query = {
            role: user_model_1.UserRole.CUSTOMER,
            status: user_model_1.UserStatus.ACTIVE,
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
        const inactiveUsers = await user_model_1.default.find(query).limit(500);
        let notifiedCount = 0;
        for (const user of inactiveUsers) {
            try {
                const now = new Date();
                // 1. Send friendly re-engagement email if email is present
                if (user.email) {
                    await email_service_1.default.sendInactivityReengagement(user.email, {
                        name: user.name || 'Food Lover',
                        actionUrl: 'https://goeatone.com',
                    });
                }
                // 2. Dispatch push notification and in-app notification
                await notification_service_1.default.sendNotification(user._id.toString(), 'We miss you! 🍽️', "Your favorite dishes are waiting! Discover what's fresh and cooking near you on Go-Eat today.", { action: 'EXPLORE_OUTLETS' }, userNotification_model_1.NotificationType.PROMOTION);
                // 3. Mark alert timestamp to enforce frequency cap
                user.lastInactivityAlertAt = now;
                await user.save();
                notifiedCount++;
            }
            catch (err) {
                logger_1.default.error(`❌ Failed to send inactivity notification to user ${user._id}:`, err?.message || err);
            }
        }
        logger_1.default.info(`✅ Inactivity scan completed: ${inactiveUsers.length} scanned, ${notifiedCount} re-engagement alerts sent.`);
        return {
            scannedCount: inactiveUsers.length,
            notifiedCount,
        };
    }
    /**
     * Starts the recurring daily inactivity scan background timer.
     */
    startInactivityCron(intervalMs = 24 * 60 * 60 * 1000) {
        if (this.cronTimer) {
            clearInterval(this.cronTimer);
        }
        logger_1.default.info(`⏰ User inactivity re-engagement background schedule active (every ${Math.round(intervalMs / (60 * 60 * 1000))} hours).`);
        // Initial check after 30 seconds to allow server boot to settle
        setTimeout(() => {
            this.checkInactiveUsersAndNotify().catch(err => logger_1.default.error('Error during initial inactivity scan:', err?.message || err));
        }, 30000);
        // Recurring interval
        this.cronTimer = setInterval(() => {
            this.checkInactiveUsersAndNotify().catch(err => logger_1.default.error('Error during recurring inactivity scan:', err?.message || err));
        }, intervalMs);
    }
    stopInactivityCron() {
        if (this.cronTimer) {
            clearInterval(this.cronTimer);
            this.cronTimer = null;
        }
    }
}
exports.default = new ActivityService();
