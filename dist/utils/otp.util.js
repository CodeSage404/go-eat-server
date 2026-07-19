"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const redis_1 = __importDefault(require("../config/redis"));
const logger_1 = __importDefault(require("./logger"));
class OTPUtil {
    /**
     * Generates a random 6-digit numeric OTP
     */
    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    /**
     * Stores OTP in Redis with a TTL (Time-To-Live)
     */
    async storeOTP(identifier, otp, ttlSeconds = 600) {
        try {
            const key = `otp:${identifier.toLowerCase()}`;
            await redis_1.default.set(key, otp, {
                EX: ttlSeconds,
            });
            logger_1.default.info(`🔑 OTP stored in Redis for ${identifier}`);
        }
        catch (error) {
            logger_1.default.error('❌ Error storing OTP in Redis:', error);
            throw error;
        }
    }
    /**
     * Verifies an OTP from Redis
     */
    async verifyOTP(identifier, otp) {
        try {
            const key = `otp:${identifier.toLowerCase()}`;
            const storedOTP = await redis_1.default.get(key);
            if (storedOTP === otp) {
                await redis_1.default.del(key);
                return true;
            }
            return false;
        }
        catch (error) {
            logger_1.default.error('❌ Error verifying OTP in Redis:', error);
            return false;
        }
    }
    /**
     * Stores pending user registration payload in Redis before DB creation
     */
    async storePendingUser(identifier, userData, ttlSeconds = 600) {
        try {
            const key = `pending_user:${identifier.toLowerCase()}`;
            await redis_1.default.set(key, JSON.stringify(userData), {
                EX: ttlSeconds,
            });
            logger_1.default.info(`💾 Pending user registration cached in Redis for ${identifier}`);
        }
        catch (error) {
            logger_1.default.error('❌ Error storing pending user in Redis:', error);
        }
    }
    /**
     * Retrieves pending user registration payload from Redis
     */
    async getPendingUser(identifier) {
        try {
            const key = `pending_user:${identifier.toLowerCase()}`;
            const data = await redis_1.default.get(key);
            if (data) {
                return JSON.parse(data);
            }
            return null;
        }
        catch (error) {
            logger_1.default.error('❌ Error fetching pending user from Redis:', error);
            return null;
        }
    }
    /**
     * Deletes pending user payload from Redis
     */
    async deletePendingUser(identifier) {
        try {
            const key = `pending_user:${identifier.toLowerCase()}`;
            await redis_1.default.del(key);
        }
        catch (error) {
            logger_1.default.error('❌ Error deleting pending user from Redis:', error);
        }
    }
}
exports.default = new OTPUtil();
