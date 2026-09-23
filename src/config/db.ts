import mongoose from 'mongoose';
import logger from '../utils/logger';
import dotenv from 'dotenv';
import { syncAllRestaurantsPromoStatus } from '../services/restaurant.service';

dotenv.config();

const mongodbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/go-eat';

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(mongodbUri);
    logger.info(`🚀 Connected to MongoDB: ${conn.connection.host}`);

    // Automatically inspect and rebuild index if email index is not sparse
    try {
      const usersCollection = conn.connection.collection('users');
      const indexes = await usersCollection.indexes();
      const emailIndex = indexes.find(idx => idx.name === 'email_1');
      if (emailIndex && !emailIndex.sparse) {
        logger.info('⚠️ Found non-sparse email index. Dropping it to rebuild as sparse...');
        await usersCollection.dropIndex('email_1');
        logger.info('✅ Successfully dropped non-sparse email index! Mongoose will rebuild it as sparse.');
      }
    } catch (indexErr: any) {
      logger.warn('Could not inspect or drop user email index (collection may not exist yet):', indexErr.message);
    }

    // Automatically ensure all restaurant documents have promo fields
    try {
      const restaurantsCollection = conn.connection.collection('restaurants');
      await restaurantsCollection.updateMany(
        { $or: [{ hasPromo: { $exists: false } }, { acceptsPromos: { $exists: false } }] },
        { $set: { hasPromo: false, acceptsPromos: false, allowStampCards: false, promoText: '' } }
      );
      logger.info('✅ Verified & migrated promo fields across all restaurant documents.');

      // Automatically ensure all restaurant documents have country fields
      await restaurantsCollection.updateMany(
        { $or: [{ country: { $exists: false } }, { country: null }, { country: '' }] },
        {
          $set: {
            country: 'Nigeria',
            countryCode: 'NG',
            'address.country': 'Nigeria',
            'address.countryCode': 'NG',
            isNigeria: true,
          }
        }
      );
      logger.info('✅ Verified & migrated country fields across all restaurant documents.');

      // Automatically sync live promo status across restaurants with active food discounts/promos
      try {
        await syncAllRestaurantsPromoStatus();
        logger.info('✅ Verified & synced live promo status across restaurants.');
      } catch (syncErr: any) {
        logger.warn('Could not sync restaurant live promo status:', syncErr.message);
      }
    } catch (migErr: any) {
      logger.warn('Could not migrate restaurant fields (collection may not exist yet):', migErr.message);
    }
  } catch (error) {
    logger.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ MongoDB Disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('⚡ MongoDB Reconnected');
});

export default connectDB;
