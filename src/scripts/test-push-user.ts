import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from '../config/db';
import User from '../models/user.model';
import notificationService from '../services/notification.service';
import logger from '../utils/logger';

async function run() {
  try {
    await connectDB();
    console.log(' Connected to Database');

    const email = 'echinecherem729@gmail.com';
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log(`? User with email "${email}" not found in database.`);
      const allUsers = await User.find({}, 'email phoneNumber name fcmToken role').limit(10);
      console.log('Existing users sample:', allUsers);
      process.exit(1);
    }

    console.log(`? Found user: ${user.name || 'No Name'} (${user.email})`);
    console.log(`   ID: ${user._id}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Notifications Enabled: ${user.notificationsEnabled}`);
    console.log(`   Push/FCM Token: ${user.fcmToken || 'NO TOKEN REGISTERED'}`);

    console.log('?? Sending push notification...');
    await notificationService.sendNotification(
      user._id.toString(),
      'Go-Eat Test Notification ??',
      'Hello! Your Go-Eat push notification service is working properly.',
      { type: 'TEST', timestamp: new Date().toISOString() }
    );

    console.log('?? Notification processed successfully!');
    setTimeout(() => process.exit(0), 2000);
  } catch (err: any) {
    console.error('? Error testing push notification:', err.message || err);
    process.exit(1);
  }
}

run();
