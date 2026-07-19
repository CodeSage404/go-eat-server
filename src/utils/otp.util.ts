import crypto from 'crypto';
import redisClient from '../config/redis';
import logger from './logger';

class OTPUtil {
  /**
   * Generates a random 6-digit numeric OTP
   */
  public generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Stores OTP in Redis with a TTL (Time-To-Live)
   */
  public async storeOTP(identifier: string, otp: string, ttlSeconds: number = 600): Promise<void> {
    try {
      const key = `otp:${identifier.toLowerCase()}`;
      await redisClient.set(key, otp, {
        EX: ttlSeconds,
      });
      logger.info(`🔑 OTP stored in Redis for ${identifier}`);
    } catch (error) {
      logger.error('❌ Error storing OTP in Redis:', error);
      throw error;
    }
  }

  /**
   * Verifies an OTP from Redis
   */
  public async verifyOTP(identifier: string, otp: string): Promise<boolean> {
    try {
      const key = `otp:${identifier.toLowerCase()}`;
      const storedOTP = await redisClient.get(key);

      if (storedOTP === otp) {
        await redisClient.del(key);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('❌ Error verifying OTP in Redis:', error);
      return false;
    }
  }

  /**
   * Stores pending user registration payload in Redis before DB creation
   */
  public async storePendingUser(identifier: string, userData: any, ttlSeconds: number = 600): Promise<void> {
    try {
      const key = `pending_user:${identifier.toLowerCase()}`;
      await redisClient.set(key, JSON.stringify(userData), {
        EX: ttlSeconds,
      });
      logger.info(`💾 Pending user registration cached in Redis for ${identifier}`);
    } catch (error) {
      logger.error('❌ Error storing pending user in Redis:', error);
    }
  }

  /**
   * Retrieves pending user registration payload from Redis
   */
  public async getPendingUser(identifier: string): Promise<any | null> {
    try {
      const key = `pending_user:${identifier.toLowerCase()}`;
      const data = await redisClient.get(key);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      logger.error('❌ Error fetching pending user from Redis:', error);
      return null;
    }
  }

  /**
   * Deletes pending user payload from Redis
   */
  public async deletePendingUser(identifier: string): Promise<void> {
    try {
      const key = `pending_user:${identifier.toLowerCase()}`;
      await redisClient.del(key);
    } catch (error) {
      logger.error('❌ Error deleting pending user from Redis:', error);
    }
  }
}

export default new OTPUtil();
