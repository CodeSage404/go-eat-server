import mongoose from 'mongoose';
import logger from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const mongodbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/go-eat';

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(mongodbUri);
    logger.info(`🚀 Connected to MongoDB: ${conn.connection.host}`);
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
