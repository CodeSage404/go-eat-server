"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server/src/utils/otp.util.ts - Cryptographic OTP Generation, In-Memory & Redis Rate Limiting
const crypto_1 = __importDefault(require("crypto"));
const redis_1 = __importDefault(require("../config/redis"));
const logger_1 = __importDefault(require("./logger"));
class OTPUtil {
    constructor() {
        this.inMemoryCache = new Map();
        this.inMemoryAttempts = new Map();
    }
    /**
     * Generates a cryptographically strong random 6-digit numeric OTP
     */
    generateOTP() {
        return crypto_1.default.randomInt(100000, 1000000).toString();
    }
    /**
     * Checks and increments OTP request attempts for an identifier (Max 6 attempts per 30 minutes)
     */
    async checkAndIncrementRequestLimit(identifier, maxAttempts = 6, windowSeconds = 1800) {
        const cleanId = identifier.toLowerCase().trim();
        const key = `otp_attempts:${cleanId}`;
        const now = Date.now();
        // 1. Try Redis
        if (redis_1.default.isOpen) {
            try {
                const current = await redis_1.default.incr(key);
                if (current === 1) {
                    await redis_1.default.expire(key, windowSeconds);
                }
                const allowed = current <= maxAttempts;
                const remaining = Math.max(0, maxAttempts - current);
                return { count: current, allowed, remaining };
            }
            catch (error) {
                logger_1.default.warn('⚠️ Redis error on OTP limit check, falling back to local memory:', error);
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
    async resetRequestLimit(identifier) {
        const cleanId = identifier.toLowerCase().trim();
        const key = `otp_attempts:${cleanId}`;
        this.inMemoryAttempts.delete(cleanId);
        if (redis_1.default.isOpen) {
            try {
                await redis_1.default.del(key);
            }
            catch (error) {
                logger_1.default.warn('⚠️ Redis error on OTP limit reset:', error);
            }
        }
    }
    /**
     * Stores OTP in Redis (and in-memory fallback) with a TTL (Time-To-Live)
     */
    async storeOTP(identifier, otp, ttlSeconds = 600) {
        const cleanId = identifier.toLowerCase().trim();
        const key = `otp:${cleanId}`;
        // Store in-memory
        this.inMemoryCache.set(key, {
            value: otp.trim(),
            expiresAt: Date.now() + ttlSeconds * 1000,
        });
        if (redis_1.default.isOpen) {
            try {
                await redis_1.default.set(key, otp.trim(), {
                    EX: ttlSeconds,
                });
                logger_1.default.info(`🔑 Fresh OTP (${otp}) stored in Redis for ${identifier}`);
            }
            catch (error) {
                logger_1.default.warn('⚠️ Redis error storing OTP, preserved in local memory:', error);
            }
        }
        else {
            logger_1.default.info(`🔑 Fresh OTP (${otp}) stored in memory for ${identifier}`);
        }
    }
    /**
     * Verifies an OTP from Redis or in-memory store
     */
    async verifyOTP(identifier, otp) {
        const cleanId = identifier.toLowerCase().trim();
        const key = `otp:${cleanId}`;
        const cleanOTP = otp.trim();
        // 1. Check Redis if available
        if (redis_1.default.isOpen) {
            try {
                const storedOTP = await redis_1.default.get(key);
                if (storedOTP === cleanOTP) {
                    await redis_1.default.del(key);
                    this.inMemoryCache.delete(key);
                    return true;
                }
            }
            catch (error) {
                logger_1.default.warn('⚠️ Redis error on OTP verify, falling back to memory store:', error);
            }
        }
        // 2. Check In-Memory Store
        const entry = this.inMemoryCache.get(key);
        if (entry && entry.expiresAt > Date.now()) {
            if (entry.value === cleanOTP) {
                this.inMemoryCache.delete(key);
                return true;
            }
        }
        return false;
    }
    /**
     * Stores pending user registration payload in Redis & memory before DB creation
     */
    async storePendingUser(identifier, userData, ttlSeconds = 600) {
        const cleanId = identifier.toLowerCase().trim();
        const key = `pending_user:${cleanId}`;
        this.inMemoryCache.set(key, {
            value: userData,
            expiresAt: Date.now() + ttlSeconds * 1000,
        });
        if (redis_1.default.isOpen) {
            try {
                await redis_1.default.set(key, JSON.stringify(userData), {
                    EX: ttlSeconds,
                });
                logger_1.default.info(`💾 Pending user registration cached in Redis for ${identifier}`);
            }
            catch (error) {
                logger_1.default.warn('⚠️ Redis error storing pending user, preserved in memory:', error);
            }
        }
    }
    /**
     * Retrieves pending user registration payload
     */
    async getPendingUser(identifier) {
        const cleanId = identifier.toLowerCase().trim();
        const key = `pending_user:${cleanId}`;
        if (redis_1.default.isOpen) {
            try {
                const data = await redis_1.default.get(key);
                if (data) {
                    return JSON.parse(data);
                }
            }
            catch (error) {
                logger_1.default.warn('⚠️ Redis error fetching pending user, checking memory:', error);
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
    async deletePendingUser(identifier) {
        const cleanId = identifier.toLowerCase().trim();
        const key = `pending_user:${cleanId}`;
        this.inMemoryCache.delete(key);
        if (redis_1.default.isOpen) {
            try {
                await redis_1.default.del(key);
            }
            catch (error) {
                logger_1.default.warn('⚠️ Redis error deleting pending user:', error);
            }
        }
    }
}
exports.default = new OTPUtil();
