import { createClient } from 'redis';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = createClient({
  url: redisUrl
});

redisClient.on('error', (err) => logger.error('❌ Redis Client Error', err));
redisClient.on('connect', () => logger.info('⚡ Redis Client Connected'));

export const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
};

export default redisClient;
