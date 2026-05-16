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
   * @param email 
   * @param otp 
   * @param ttlSeconds 
   */
  public async storeOTP(email: string, otp: string, ttlSeconds: number = 600): Promise<void> {
    try {
      const key = `otp:${email}`;
      await redisClient.set(key, otp, {
        EX: ttlSeconds,
      });
      logger.info(`🔑 OTP stored in Redis for ${email}`);
    } catch (error) {
      logger.error('❌ Error storing OTP in Redis:', error);
      throw error;
    }
  }

  /**
   * Verifies an OTP from Redis
   * @param email 
   * @param otp
   */
  public async verifyOTP(email: string, otp: string): Promise<boolean> {
    try {
      const key = `otp:${email}`;
      const storedOTP = await redisClient.get(key);

      if (storedOTP === otp) {
        // Delete OTP after successful verification
        await redisClient.del(key);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('❌ Error verifying OTP in Redis:', error);
      return false;
    }
  }
}

export default new OTPUtil();
