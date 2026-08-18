"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importStar(require("../models/user.model"));
const appError_1 = __importDefault(require("../utils/appError"));
const logger_1 = __importDefault(require("../utils/logger"));
const google_auth_library_1 = require("google-auth-library");
const apple_signin_auth_1 = __importDefault(require("apple-signin-auth"));
const googleClient = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
class AuthService {
    signToken(id) {
        const options = {
            expiresIn: process.env.JWT_EXPIRES_IN || '365d',
        };
        return jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET, options);
    }
    /**
     * Sanitizes input and validates uniqueness against existing VERIFIED users in MongoDB.
     * Does NOT save the user to MongoDB yet.
     */
    async validateUniqueness(userData) {
        const cleanData = { ...userData };
        if (cleanData.email === '' || cleanData.email === null || cleanData.email === undefined) {
            delete cleanData.email;
        }
        else {
            cleanData.email = cleanData.email.toLowerCase().trim();
        }
        if (cleanData.phoneNumber === '' || cleanData.phoneNumber === null || cleanData.phoneNumber === undefined) {
            delete cleanData.phoneNumber;
        }
        else {
            cleanData.phoneNumber = cleanData.phoneNumber.trim();
        }
        if (cleanData.phoneNumber) {
            const existingUser = await user_model_1.default.findOne({ phoneNumber: cleanData.phoneNumber });
            if (existingUser) {
                if (existingUser.isVerified) {
                    throw new appError_1.default('Phone number already in use', 400);
                }
                else {
                    // Remove old unverified record to allow fresh re-signup
                    await user_model_1.default.deleteOne({ _id: existingUser._id });
                }
            }
        }
        if (cleanData.email) {
            const existingUser = await user_model_1.default.findOne({ email: cleanData.email });
            if (existingUser) {
                if (existingUser.isVerified) {
                    throw new appError_1.default('Email already in use', 400);
                }
                else {
                    // Remove old unverified record to allow fresh re-signup
                    await user_model_1.default.deleteOne({ _id: existingUser._id });
                }
            }
        }
        return cleanData;
    }
    /**
     * Creates or activates a verified user in MongoDB AFTER OTP verification succeeds.
     */
    async createVerifiedUser(userData) {
        const cleanData = await this.validateUniqueness(userData);
        cleanData.isVerified = true;
        const user = await user_model_1.default.create(cleanData);
        if (user.referredBy) {
            try {
                await user_model_1.default.findByIdAndUpdate(user.referredBy, {
                    $inc: { referralCount: 1, referralEarnings: 500 }
                });
                logger_1.default.info(`🎁 Referral bonus applied to referrer: ${user.referredBy}`);
            }
            catch (err) {
                logger_1.default.error(`Failed to update referrer count:`, err);
            }
        }
        const token = this.signToken(user._id);
        user.password = undefined;
        logger_1.default.info(`👤 New verified user created in DB: ${user.phoneNumber || user.email} as ${user.role}`);
        return { user, token };
    }
    async register(userData) {
        return this.createVerifiedUser(userData);
    }
    async login(identifier, password) {
        if (!identifier || !password) {
            throw new appError_1.default('Please provide email/phone and password', 400);
        }
        const user = await user_model_1.default.findOne({
            $or: [
                { email: identifier.toLowerCase() },
                { phoneNumber: identifier }
            ]
        }).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            throw new appError_1.default('Incorrect email/phone or password', 401);
        }
        const token = this.signToken(user._id);
        user.password = undefined;
        logger_1.default.info(`👤 User logged in: ${user.phoneNumber || user.email}`);
        return { user, token };
    }
    async socialLogin(type, token, role = user_model_1.UserRole.CUSTOMER) {
        let email;
        let socialId;
        let name;
        if (type === 'google') {
            const ticket = await googleClient.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            if (!payload)
                throw new appError_1.default('Invalid Google token', 400);
            email = payload.email;
            socialId = payload.sub;
            name = payload.name;
        }
        else {
            const { sub: appleSub, email: appleEmail } = await apple_signin_auth_1.default.verifyIdToken(token, {
                audience: process.env.APPLE_CLIENT_ID,
            });
            email = appleEmail;
            socialId = appleSub;
            name = email.split('@')[0]; // Apple doesn't always provide name
        }
        let user = await user_model_1.default.findOne({ email });
        if (user) {
            if (type === 'google' && !user.googleId)
                user.googleId = socialId;
            if (type === 'apple' && !user.appleId)
                user.appleId = socialId;
            await user.save();
        }
        else {
            user = await user_model_1.default.create({
                email,
                name,
                role,
                googleId: type === 'google' ? socialId : undefined,
                appleId: type === 'apple' ? socialId : undefined,
                isVerified: true,
            });
        }
        const jwtToken = this.signToken(user._id);
        return { user, token: jwtToken };
    }
}
exports.default = new AuthService();
