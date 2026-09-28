// server/src/utils/otp.util.ts - Cryptographic OTP Generation, In-Memory & Redis Rate Limiting
import crypto from 'crypto';
import redisClient from '../config/redis';
import logger from './logger';

class OTPUtil {
  private inMemoryCache: Map<string, { value: any; expiresAt: number }> = new Map();
  private inMemoryAttempts: Map<string, { count: number; expiresAt: number }> = new Map();

  /**
   * Generates a cryptographically strong random 6-digit numeric OTP
   */
  public generateOTP(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Checks and increments OTP request attempts for an identifier (Max 6 attempts per 30 minutes)
   */
  public async checkAndIncrementRequestLimit(
    identifier: string,
    maxAttempts: number = 6,
    windowSeconds: number = 1800
  ): Promise<{ count: number; allowed: boolean; remaining: number }> {
    const cleanId = identifier.toLowerCase().trim();
    const key = `otp_attempts:${cleanId}`;
    const now = Date.now();

    // 1. Try Redis
    if (redisClient.isOpen) {
      try {
        const current = await redisClient.incr(key);
        if (current === 1) {
          await redisClient.expire(key, windowSeconds);
        }
        const allowed = current <= maxAttempts;
        const remaining = Math.max(0, maxAttempts - current);
        return { count: current, allowed, remaining };
      } catch (error) {
        logger.warn('⚠️ Redis error on OTP limit check, falling back to local memory:', error);
      }
    }

    // 2. In-Memory Fallback
    const existing = this.inMemoryAttempts.get(cleanId);
    if (!existing || existing.expiresAt < now) {
      this.inMemoryAttempts.set(cleanId, {
        count: 1,
        expiresAt: now + windowSeconds * 1000,
      });
      return { count: 1, allowed: true, remaining: maxAttempts - 1 };
    }

    existing.count += 1;
    const allowed = existing.count <= maxAttempts;
    const remaining = Math.max(0, maxAttempts - existing.count);
    return { count: existing.count, allowed, remaining };
  }

  /**
   * Resets OTP request attempt counter for an identifier after successful verification
   */
  public async resetRequestLimit(identifier: string): Promise<void> {
    const cleanId = identifier.toLowerCase().trim();
    const key = `otp_attempts:${cleanId}`;

    this.inMemoryAttempts.delete(cleanId);

    if (redisClient.isOpen) {
      try {
        await redisClient.del(key);
      } catch (error) {
        logger.warn('⚠️ Redis error on OTP limit reset:', error);
      }
    }
  }

  /**
   * Stores OTP in Redis (and in-memory fallback) with a TTL (Time-To-Live)
   */
  public async storeOTP(identifier: string, otp: string, ttlSeconds: number = 600): Promise<void> {
    const cleanId = identifier.toLowerCase().trim();
    const key = `otp:${cleanId}`;

    // Store in-memory
    this.inMemoryCache.set(key, {
      value: otp.trim(),
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    if (redisClient.isOpen) {
      try {
        await redisClient.set(key, otp.trim(), {
          EX: ttlSeconds,
        });
        logger.info(`🔑 Fresh OTP generated and stored in Redis for ${identifier}`);
      } catch (error) {
        logger.warn('⚠️ Redis error storing OTP, preserved in local memory:', error);
      }
    } else {
      logger.info(`🔑 Fresh OTP generated and stored in memory for ${identifier}`);
    }
  }

  /**
   * Verifies an OTP from Redis or in-memory store
   * Protects against brute-force attacks by invalidating the OTP after 5 failed attempts
   */
  public async verifyOTP(identifier: string, otp: string): Promise<boolean> {
    const cleanId = identifier.toLowerCase().trim();
    const key = `otp:${cleanId}`;
    const failedKey = `otp_failed_attempts:${cleanId}`;
    const cleanOTP = otp.trim();

    let isMatch = false;

    // 1. Check Redis if available
    if (redisClient.isOpen) {
      try {
        const storedOTP = await redisClient.get(key);
        if (storedOTP && storedOTP === cleanOTP) {
          isMatch = true;
        }
      } catch (error) {
        logger.warn('⚠️ Redis error on OTP verify, falling back to memory store:', error);
      }
    }

    // 2. Check In-Memory Store
    if (!isMatch) {
      const entry = this.inMemoryCache.get(key);
      if (entry && entry.expiresAt > Date.now() && entry.value === cleanOTP) {
        isMatch = true;
      }
    }

    if (isMatch) {
      // Clear OTP and failed attempt counters
      this.inMemoryCache.delete(key);
      this.inMemoryAttempts.delete(failedKey);
      if (redisClient.isOpen) {
        try {
          await redisClient.del(key);
          await redisClient.del(failedKey);
        } catch (_) {}
      }
      return true;
    }

    // Track failed attempt
    let failedCount = 1;
    if (redisClient.isOpen) {
      try {
        failedCount = await redisClient.incr(failedKey);
        if (failedCount === 1) {
          await redisClient.expire(failedKey, 600);
        }
      } catch (_) {}
    } else {
      const existing = this.inMemoryAttempts.get(failedKey);
      if (existing && existing.expiresAt > Date.now()) {
        existing.count += 1;
        failedCount = existing.count;
      } else {
        this.inMemoryAttempts.set(failedKey, { count: 1, expiresAt: Date.now() + 600000 });
      }
    }

    // Invalidate OTP immediately if 5 or more incorrect attempts occur
    if (failedCount >= 5) {
      logger.warn(`🚫 OTP for ${identifier} burned/invalidated after exceeding 5 failed attempts.`);
      this.inMemoryCache.delete(key);
      this.inMemoryAttempts.delete(failedKey);
      if (redisClient.isOpen) {
        try {
          await redisClient.del(key);
          await redisClient.del(failedKey);
        } catch (_) {}
      }
    }

    return false;
  }

  /**
   * Stores pending user registration payload in Redis & memory before DB creation
   */
  public async storePendingUser(identifier: string, userData: any, ttlSeconds: number = 600): Promise<void> {
    const cleanId = identifier.toLowerCase().trim();
    const key = `pending_user:${cleanId}`;

    this.inMemoryCache.set(key, {
      value: userData,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    if (redisClient.isOpen) {
      try {
        await redisClient.set(key, JSON.stringify(userData), {
          EX: ttlSeconds,
        });
        logger.info(`💾 Pending user registration cached in Redis for ${identifier}`);
      } catch (error) {
        logger.warn('⚠️ Redis error storing pending user, preserved in memory:', error);
      }
    }
  }

  /**
   * Retrieves pending user registration payload
   */
  public async getPendingUser(identifier: string): Promise<any | null> {
    const cleanId = identifier.toLowerCase().trim();
    const key = `pending_user:${cleanId}`;

    if (redisClient.isOpen) {
      try {
        const data = await redisClient.get(key);
        if (data) {
          return JSON.parse(data);
        }
      } catch (error) {
        logger.warn('⚠️ Redis error fetching pending user, checking memory:', error);
      }
    }

    const entry = this.inMemoryCache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value;
    }

    return null;
  }

  /**
   * Deletes pending user payload
   */
  public async deletePendingUser(identifier: string): Promise<void> {
    const cleanId = identifier.toLowerCase().trim();
    const key = `pending_user:${cleanId}`;

    this.inMemoryCache.delete(key);

    if (redisClient.isOpen) {
      try {
        await redisClient.del(key);
      } catch (error) {
        logger.warn('⚠️ Redis error deleting pending user:', error);
      }
    }
  }
}

export default new OTPUtil();
