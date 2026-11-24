import User, { IUser, UserRole, UserStatus } from '../models/user.model';
import emailService from './email.service';
import notificationService from './notification.service';
import { NotificationType } from '../models/userNotification.model';
import logger from '../utils/logger';

export interface MarketingTheme {
  id: string;
  badgeText: string;
  pushTitle: string;
  pushBody: string;
  emailSubject: string;
  headline: string;
  subheadline: string;
  introText: string;
  highlightTitle: string;
  highlightText: string;
  buttonText: string;
  actionUrl: string;
}

export const MARKETING_THEMES: MarketingTheme[] = [
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
  private cronTimer: NodeJS.Timeout | null = null;
  private readonly COOLDOWN_DAYS = 14; // Strictly enforce bi-weekly cadence per user

  /**
   * Scans for customers whose bi-weekly promotional cooldown has elapsed and dispatches
   * dynamic, rotating marketing push notifications and emails.
   */
  public async runBiWeeklyPromotionalCampaign(): Promise<{
    scannedCount: number;
    pushSentCount: number;
    emailSentCount: number;
  }> {
    const cooldownThreshold = new Date(Date.now() - this.COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

    logger.info(`🎯 Running bi-weekly promotional campaign scan (Cooldown threshold: ${cooldownThreshold.toISOString()})...`);

    // Target active, verified customers whose last promotional communication was >= 14 days ago (or never)
    const query = {
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      isVerified: true,
      notificationsEnabled: { $ne: false },
      $or: [
        { lastPromotionalNotificationAt: { $exists: false } },
        { lastPromotionalNotificationAt: null },
        { lastPromotionalNotificationAt: { $lt: cooldownThreshold } },
      ],
    };

    // Process in batches of up to 300 users per scan to balance server I/O
    const eligibleUsers = await User.find(query).limit(300);

    let pushSentCount = 0;
    let emailSentCount = 0;

    for (const user of eligibleUsers) {
      try {
        const now = new Date();

        // Rotate through themes sequentially for each user so content continually changes over time
        const currentThemeIndex = typeof user.lastPromotionalThemeIndex === 'number' ? user.lastPromotionalThemeIndex : -1;
        const nextThemeIndex = (currentThemeIndex + 1) % MARKETING_THEMES.length;
        const theme = MARKETING_THEMES[nextThemeIndex];

        const userName = user.name ? user.name.split(' ')[0] : 'Food Lover';
        const userPrefs = user.notificationPreferences;

        // 1. Send Push Notification if push notifications are enabled
        const allowPush = userPrefs ? userPrefs.push !== false : true;
        if (allowPush) {
          try {
            await notificationService.sendNotification(
              user._id.toString(),
              theme.pushTitle,
              theme.pushBody,
              {
                action: 'EXPLORE_RESTAURANTS',
                themeId: theme.id,
                target: '/store',
              },
              NotificationType.PROMOTION
            );
            pushSentCount++;
          } catch (pushErr: any) {
            logger.warn(`Could not dispatch promotional push to user ${user._id}:`, pushErr?.message || pushErr);
          }
        }

        // 2. Send Promotional Email if email notifications are enabled and user has an email
        const allowEmail = userPrefs ? userPrefs.email !== false : true;
        if (allowEmail && user.email) {
          try {
            await emailService.sendPromotionalEngagement(
              user.email,
              {
                name: userName,
                headline: theme.headline,
                subheadline: theme.subheadline,
                badgeText: theme.badgeText,
                introText: theme.introText,
                highlightTitle: theme.highlightTitle,
                highlightText: theme.highlightText,
                buttonText: theme.buttonText,
                actionUrl: theme.actionUrl,
              },
              theme.emailSubject
            );
            emailSentCount++;
          } catch (emailErr: any) {
            logger.warn(`Could not dispatch promotional email to ${user.email}:`, emailErr?.message || emailErr);
          }
        }

        // 3. Update User promotional state and advance theme index
        user.lastPromotionalNotificationAt = now;
        user.lastPromotionalThemeIndex = nextThemeIndex;
        await user.save();
      } catch (userErr: any) {
        logger.error(`Failed to process promotional campaign for user ${user._id}:`, userErr?.message || userErr);
      }
    }

    logger.info(
      `✅ Bi-weekly promotional campaign completed: ${eligibleUsers.length} scanned, ${pushSentCount} pushes sent, ${emailSentCount} emails dispatched.`
    );

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
  public startCampaignCron(intervalMs: number = 24 * 60 * 60 * 1000): void {
    if (this.cronTimer) {
      clearInterval(this.cronTimer);
    }

    logger.info(`⏰ Automated marketing & promotional campaign scheduler initialized (every ${Math.round(intervalMs / (60 * 60 * 1000))} hours).`);

    // Stagger initial check by 45 seconds after server boot to prevent startup spikes
    setTimeout(() => {
      this.runBiWeeklyPromotionalCampaign().catch(err =>
        logger.error('Error during initial promotional campaign scan:', err?.message || err)
      );
    }, 45000);

    // Recurring daily evaluation
    this.cronTimer = setInterval(() => {
      this.runBiWeeklyPromotionalCampaign().catch(err =>
        logger.error('Error during recurring promotional campaign scan:', err?.message || err)
      );
    }, intervalMs);
  }

  /**
   * Stops the recurring campaign cron (e.g. for testing or shutdown).
   */
  public stopCampaignCron(): void {
    if (this.cronTimer) {
      clearInterval(this.cronTimer);
      this.cronTimer = null;
    }
  }
}

export default new MarketingService();
