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
exports.MARKETING_THEMES = void 0;
const user_model_1 = __importStar(require("../models/user.model"));
const email_service_1 = __importDefault(require("./email.service"));
const notification_service_1 = __importDefault(require("./notification.service"));
const userNotification_model_1 = require("../models/userNotification.model");
const logger_1 = __importDefault(require("../utils/logger"));
exports.MARKETING_THEMES = [
    {
        id: 'local_discovery',
        badgeText: 'Discover Local',
        pushTitle: 'Discover Restaurants Near You 🍽️',
        pushBody: 'Hot dishes, fresh flavors, and top neighborhood food spots are cooking right now on GoEatOne.',
        emailSubject: 'Discover delicious restaurants near you on GoEatOne',
        headline: 'Uncover the Best Flavors in Your Neighborhood',
        subheadline: 'From trending local hotspots to beloved hidden gems, delicious meals are just a tap away.',
        introText: 'Looking for your next great meal? GoEatOne connects you directly with top-rated local eateries, vibrant cloud kitchens, and artisan bakeries in your area.',
        highlightTitle: 'Freshly Prepared & Delivered Fast',
        highlightText: 'Browse real menus with transparent pricing and live courier tracking straight to your door.',
        buttonText: 'Discover Restaurants Near You',
        actionUrl: 'https://goeatone.com/store',
    },
    {
        id: 'weekend_specials',
        badgeText: 'Weekend Treats',
        pushTitle: 'Weekend Feast Loading? 🍔🍕',
        pushBody: 'Skip cooking this weekend! Treat yourself and your loved ones to mouthwatering chef specials on GoEatOne.',
        emailSubject: 'Weekend plans? Treat yourself to top-rated feasts on GoEatOne',
        headline: 'Your Ultimate Weekend Feast Awaits',
        subheadline: 'Crispy pizzas, juicy grilled specials, authentic local dishes, and decadent desserts delivered hot.',
        introText: 'Weekends are meant for relaxing. Let our partner kitchens do the hard work while you kick back and savor incredible food with family and friends.',
        highlightTitle: 'Special Weekend Picks',
        highlightText: 'Handpicked family platters, sharing boxes, and customer-favorite combos available right now.',
        buttonText: 'Order Weekend Feasts',
        actionUrl: 'https://goeatone.com/store',
    },
    {
        id: 'busy_day_fuel',
        badgeText: 'Quick & Hot',
        pushTitle: 'Hungry? Power through your day 🍜✨',
        pushBody: 'Take a delicious break! Quick lunch, healthy salads, and hearty bowls delivered in minutes.',
        emailSubject: 'Beat the rush with speedy, fresh meals from GoEatOne',
        headline: 'Delicious Meals, Zero Kitchen Hassle',
        subheadline: 'Get back your time with fast, freshly prepared lunch and dinner favorites.',
        introText: 'Whether you are in back-to-back meetings, studying, or catching your breath after a busy morning, delicious nourishment is just minutes away.',
        highlightTitle: 'Express Kitchen Dispatch',
        highlightText: 'Priority delivery from fast-prep restaurants so you never have to wait hungry.',
        buttonText: 'Order Lunch or Dinner',
        actionUrl: 'https://goeatone.com/store',
    },
    {
        id: 'sweet_desserts',
        badgeText: 'Sweet Cravings',
        pushTitle: 'Your sweet tooth called 🍰🍨',
        pushBody: 'Fresh warm pastries, creamy gelato, milkshakes, and artisanal sweets waiting for you on GoEatOne.',
        emailSubject: 'Time for a treat? Indulge in local desserts on GoEatOne',
        headline: 'Life is Sweet — Treat Yourself Today',
        subheadline: 'Indulge in handcrafted bakeries, fresh waffle creations, and cooling gelato near you.',
        introText: 'Everyone deserves a delightful reward. Explore our curated selection of dessert parlors and local bakeries offering freshly baked goods.',
        highlightTitle: 'Artisan Confectionery & Pastries',
        highlightText: 'Carefully packaged to arrive pristine and ready for your indulgence.',
        buttonText: 'Browse Sweet Treats',
        actionUrl: 'https://goeatone.com/store',
    },
    {
        id: 'authentic_specialties',
        badgeText: 'Authentic Kitchens',
        pushTitle: 'Craving authentic home-style food? 🍲',
        pushBody: 'Sizzling pots, traditional spices, and cultural culinary gems crafted by authentic local chefs.',
        emailSubject: 'Sizzling pots & authentic meals are ready on GoEatOne',
        headline: 'Authentic Flavors, Delivered Fresh',
        subheadline: 'Experience the rich tastes of traditional recipes and beloved regional specialties.',
        introText: 'Nothing beats the comfort of authentic, hearty food cooked with passion and heritage recipes. Discover home-style dining right from the app.',
        highlightTitle: 'Crafted with Authentic Ingredients',
        highlightText: 'Support local culinary entrepreneurs cooking authentic generational dishes.',
        buttonText: 'Explore Authentic Specials',
        actionUrl: 'https://goeatone.com/store',
    },
];
class MarketingService {
    constructor() {
        this.cronTimer = null;
        this.COOLDOWN_DAYS = 14; // Strictly enforce bi-weekly cadence per user
    }
    /**
     * Scans for customers whose bi-weekly promotional cooldown has elapsed and dispatches
     * dynamic, rotating marketing push notifications and emails.
     */
    async runBiWeeklyPromotionalCampaign() {
        const cooldownThreshold = new Date(Date.now() - this.COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
        logger_1.default.info(`🎯 Running bi-weekly promotional campaign scan (Cooldown threshold: ${cooldownThreshold.toISOString()})...`);
        // Target active, verified customers whose last promotional communication was >= 14 days ago (or never)
        const query = {
            role: user_model_1.UserRole.CUSTOMER,
            status: user_model_1.UserStatus.ACTIVE,
            isVerified: true,
            notificationsEnabled: { $ne: false },
            $or: [
                { lastPromotionalNotificationAt: { $exists: false } },
                { lastPromotionalNotificationAt: null },
                { lastPromotionalNotificationAt: { $lt: cooldownThreshold } },
            ],
        };
        // Process in batches of up to 300 users per scan to balance server I/O
        const eligibleUsers = await user_model_1.default.find(query).limit(300);
        let pushSentCount = 0;
        let emailSentCount = 0;
        for (const user of eligibleUsers) {
            try {
                const now = new Date();
                // Rotate through themes sequentially for each user so content continually changes over time
                const currentThemeIndex = typeof user.lastPromotionalThemeIndex === 'number' ? user.lastPromotionalThemeIndex : -1;
                const nextThemeIndex = (currentThemeIndex + 1) % exports.MARKETING_THEMES.length;
                const theme = exports.MARKETING_THEMES[nextThemeIndex];
                const userName = user.name ? user.name.split(' ')[0] : 'Food Lover';
                const userPrefs = user.notificationPreferences;
                // 1. Send Push Notification if push notifications are enabled
                const allowPush = userPrefs ? userPrefs.push !== false : true;
                if (allowPush) {
                    try {
                        await notification_service_1.default.sendNotification(user._id.toString(), theme.pushTitle, theme.pushBody, {
                            action: 'EXPLORE_RESTAURANTS',
                            themeId: theme.id,
                            target: '/store',
                        }, userNotification_model_1.NotificationType.PROMOTION);
                        pushSentCount++;
                    }
                    catch (pushErr) {
                        logger_1.default.warn(`Could not dispatch promotional push to user ${user._id}:`, pushErr?.message || pushErr);
                    }
                }
                // 2. Send Promotional Email if email notifications are enabled and user has an email
                const allowEmail = userPrefs ? userPrefs.email !== false : true;
                if (allowEmail && user.email) {
                    try {
                        await email_service_1.default.sendPromotionalEngagement(user.email, {
                            name: userName,
                            headline: theme.headline,
                            subheadline: theme.subheadline,
                            badgeText: theme.badgeText,
                            introText: theme.introText,
                            highlightTitle: theme.highlightTitle,
                            highlightText: theme.highlightText,
                            buttonText: theme.buttonText,
                            actionUrl: theme.actionUrl,
                        }, theme.emailSubject);
                        emailSentCount++;
                    }
                    catch (emailErr) {
                        logger_1.default.warn(`Could not dispatch promotional email to ${user.email}:`, emailErr?.message || emailErr);
                    }
                }
                // 3. Update User promotional state and advance theme index
                user.lastPromotionalNotificationAt = now;
                user.lastPromotionalThemeIndex = nextThemeIndex;
                await user.save();
            }
            catch (userErr) {
                logger_1.default.error(`Failed to process promotional campaign for user ${user._id}:`, userErr?.message || userErr);
            }
        }
        logger_1.default.info(`✅ Bi-weekly promotional campaign completed: ${eligibleUsers.length} scanned, ${pushSentCount} pushes sent, ${emailSentCount} emails dispatched.`);
        return {
            scannedCount: eligibleUsers.length,
            pushSentCount,
            emailSentCount,
        };
    }
    /**
     * Starts the recurring automated campaign cron.
     * Runs daily to catch any users reaching their 14-day cycle with randomized timing.
     */
    startCampaignCron(intervalMs = 24 * 60 * 60 * 1000) {
        if (this.cronTimer) {
            clearInterval(this.cronTimer);
        }
        logger_1.default.info(`⏰ Automated marketing & promotional campaign scheduler initialized (every ${Math.round(intervalMs / (60 * 60 * 1000))} hours).`);
        // Stagger initial check by 45 seconds after server boot to prevent startup spikes
        setTimeout(() => {
            this.runBiWeeklyPromotionalCampaign().catch(err => logger_1.default.error('Error during initial promotional campaign scan:', err?.message || err));
        }, 45000);
        // Recurring daily evaluation
        this.cronTimer = setInterval(() => {
            this.runBiWeeklyPromotionalCampaign().catch(err => logger_1.default.error('Error during recurring promotional campaign scan:', err?.message || err));
        }, intervalMs);
    }
    /**
     * Stops the recurring campaign cron (e.g. for testing or shutdown).
     */
    stopCampaignCron() {
        if (this.cronTimer) {
            clearInterval(this.cronTimer);
            this.cronTimer = null;
        }
    }
}
exports.default = new MarketingService();
