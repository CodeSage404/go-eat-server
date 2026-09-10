import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import admin from 'firebase-admin';

// Load environment variables
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

import User from '../src/models/user.model';
import notificationService from '../src/services/notification.service';
import { NotificationType } from '../src/models/userNotification.model';

const targetEmail = process.argv[2] || 'nwafor.synthdatasolutions@gmail.com';

async function main() {
  console.log(`\n🔔 Initiating Push Notification Test for: ${targetEmail}`);

  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log('📦 Connected to MongoDB');

  const user = await User.findOne({ email: targetEmail.toLowerCase() });
  if (!user) {
    console.error(`❌ User with email "${targetEmail}" not found in database!`);
    process.exit(1);
  }

  console.log(`👤 User Found: ${user.name} (${user.role}) - ID: ${user._id}`);
  console.log(`🔑 Stored FCM/Push Token: ${user.fcmToken || 'NONE'}`);

  if (!user.fcmToken) {
    console.error(`⚠️ User does not have an active fcmToken in the database. Open the mobile app and log in so the device registers its push token.`);
    process.exit(1);
  }

  try {
    console.log(`🚀 Dispatching push notification via notificationService...`);
    await notificationService.sendNotification(
      user._id.toString(),
      '🔔 Test Vendor Push Notification! 🍕',
      'Hello Bella Pizza Hub! Push notifications are live and working on Go-Eat Vendor!',
      {
        type: 'TEST_PUSH',
        orderId: 'none',
        timestamp: new Date().toISOString(),
      },
      NotificationType.SYSTEM
    );
    console.log(`✅ Push notification sent successfully!`);
  } catch (err: any) {
    console.error(`❌ Failed to send push notification:`, err.message || err);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
