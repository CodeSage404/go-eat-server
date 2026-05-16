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
     * @param email
     * @param otp
     * @param ttlSeconds
     */
    async storeOTP(email, otp, ttlSeconds = 600) {
        try {
            const key = `otp:${email}`;
            await redis_1.default.set(key, otp, {
                EX: ttlSeconds,
            });
            logger_1.default.info(`🔑 OTP stored in Redis for ${email}`);
        }
        catch (error) {
            logger_1.default.error('❌ Error storing OTP in Redis:', error);
            throw error;
        }
    }
    /**
     * Verifies an OTP from Redis
     * @param email
     * @param otp
     */
    async verifyOTP(email, otp) {
        try {
            const key = `otp:${email}`;
            const storedOTP = await redis_1.default.get(key);
            if (storedOTP === otp) {
                // Delete OTP after successful verification
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
}
exports.default = new OTPUtil();
