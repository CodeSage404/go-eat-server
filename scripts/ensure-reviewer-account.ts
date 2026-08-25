import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env variables from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

import User, { UserRole, UserStatus } from '../src/models/user.model';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/go-eat';
const REVIEWER_EMAIL = 'echinecherem729@gmail.com';
const REVIEWER_PASSWORD = '@123456Bi';

async function ensureReviewerAccount() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB successfully!');

    let user = await User.findOne({ email: REVIEWER_EMAIL.toLowerCase() }).select('+password');

    if (user) {
      console.log(`Found existing user account for ${REVIEWER_EMAIL}. Updating password and permissions...`);
      user.password = REVIEWER_PASSWORD;
      user.status = UserStatus.ACTIVE;
      user.isVerified = true;
      user.role = UserRole.CUSTOMER;
      await user.save();
      console.log(`✅ User account for ${REVIEWER_EMAIL} successfully updated!`);
    } else {
      console.log(`Creating new reviewer customer account for ${REVIEWER_EMAIL}...`);
      user = await User.create({
        name: 'App Reviewer',
        email: REVIEWER_EMAIL.toLowerCase(),
        password: REVIEWER_PASSWORD,
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        isVerified: true,
        phoneNumber: '+2348000000999',
        notificationsEnabled: true,
        country: 'Nigeria',
        isNigeria: true,
      });
      console.log(`✅ User account for ${REVIEWER_EMAIL} successfully created!`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error ensuring reviewer account:', error);
    process.exit(1);
  }
}

ensureReviewerAccount();
