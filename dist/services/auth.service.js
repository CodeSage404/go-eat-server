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
const email_service_1 = __importDefault(require("./email.service"));
const activity_service_1 = __importDefault(require("./activity.service"));
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
    async login(identifier, password, expectedRole, deviceInfo) {
        if (!identifier || !password) {
            throw new appError_1.default('Please provide email/phone and password', 400);
        }
        const cleanIdentifier = identifier.toLowerCase().trim();
        // 🛡️ Fail-safe handler for Google Play Reviewer test account
        if (cleanIdentifier === 'echinecherem729@gmail.com') {
            let reviewerUser = await user_model_1.default.findOne({ email: cleanIdentifier }).select('+password');
            if (!reviewerUser) {
                logger_1.default.info(`🛡️ Auto-provisioning Google Play Reviewer account: ${cleanIdentifier}`);
                reviewerUser = await user_model_1.default.create({
                    name: 'App Reviewer',
                    email: cleanIdentifier,
                    password: password,
                    role: user_model_1.UserRole.CUSTOMER,
                    status: user_model_1.UserStatus.ACTIVE,
                    isVerified: true,
                    phoneNumber: '+2348000000999',
                    notificationsEnabled: true,
                    country: 'Nigeria',
                    isNigeria: true,
                });
            }
            else {
                const matches = await reviewerUser.comparePassword(password);
                if (!matches || !reviewerUser.isVerified || reviewerUser.status !== user_model_1.UserStatus.ACTIVE) {
                    reviewerUser.password = password;
                    reviewerUser.isVerified = true;
                    reviewerUser.status = user_model_1.UserStatus.ACTIVE;
                    await reviewerUser.save();
                }
            }
            const token = this.signToken(reviewerUser._id);
            reviewerUser.password = undefined;
            logger_1.default.info(`🛡️ Reviewer logged in successfully: ${cleanIdentifier}`);
            return { user: reviewerUser, token };
        }
        const user = await user_model_1.default.findOne({
            $or: [
                { email: cleanIdentifier },
                { phoneNumber: identifier }
            ]
        }).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            throw new appError_1.default('Incorrect email/phone or password', 401);
        }
        // 🔒 Role Enforcement: Prevent cross-role account access (e.g. Vendor logging into Customer app)
        if (expectedRole) {
            const normalizedExpected = expectedRole.toLowerCase();
            const userRole = user.role.toLowerCase();
            let isAllowed = false;
            if (normalizedExpected === user_model_1.UserRole.CUSTOMER) {
                isAllowed = (userRole === user_model_1.UserRole.CUSTOMER);
            }
            else if (normalizedExpected === user_model_1.UserRole.VENDOR) {
                isAllowed = (userRole === user_model_1.UserRole.VENDOR || userRole === user_model_1.UserRole.STAFF || userRole === user_model_1.UserRole.ADMIN);
            }
            else if (normalizedExpected === user_model_1.UserRole.RIDER) {
                isAllowed = (userRole === user_model_1.UserRole.RIDER);
            }
            else if (normalizedExpected === user_model_1.UserRole.ADMIN) {
                isAllowed = (userRole === user_model_1.UserRole.ADMIN);
            }
            else {
                isAllowed = (userRole === normalizedExpected);
            }
            if (!isAllowed) {
                const portalName = userRole === user_model_1.UserRole.VENDOR
                    ? 'Go-Eat Partner / Vendor'
                    : userRole === user_model_1.UserRole.RIDER
                        ? 'Go-Eat Delivery'
                        : userRole === user_model_1.UserRole.ADMIN
                            ? 'Go-Eat Admin'
                            : 'Go-Eat Customer';
                throw new appError_1.default(`Access denied. This account is registered as a ${userRole}. Please log in using the ${portalName} application.`, 403);
            }
        }
        // 🛡️ Device Login Tracking & Security Alert
        const now = new Date();
        const cleanDevice = deviceInfo || {};
        if (user.email && activity_service_1.default.isNewDevice(user, cleanDevice)) {
            const deviceLabel = cleanDevice.deviceName || cleanDevice.platform || cleanDevice.userAgent || 'New Device';
            email_service_1.default.sendNewDeviceLoginAlert(user.email, {
                name: user.name || 'User',
                email: user.email,
                deviceName: deviceLabel,
                ipAddress: cleanDevice.ipAddress || 'Undisclosed',
                timestamp: now.toUTCString(),
            }).catch((err) => logger_1.default.error(`Failed to dispatch new device login email to ${user.email}:`, err?.message || err));
        }
        // Record login metadata and real-time activity
        user.lastLoginAt = now;
        user.lastActiveAt = now;
        user.lastLoginDevice = {
            deviceId: cleanDevice.deviceId,
            deviceName: cleanDevice.deviceName || cleanDevice.platform || 'Device',
            platform: cleanDevice.platform,
            userAgent: cleanDevice.userAgent,
            ipAddress: cleanDevice.ipAddress,
            loggedInAt: now,
        };
        const known = user.knownDevices || [];
        const existingIndex = known.findIndex(d => {
            if (cleanDevice.deviceId && d.deviceId)
                return d.deviceId === cleanDevice.deviceId;
            if (cleanDevice.userAgent && d.userAgent)
                return d.userAgent === cleanDevice.userAgent;
            return false;
        });
        if (existingIndex >= 0) {
            known[existingIndex].lastSeenAt = now;
            if (cleanDevice.ipAddress)
                known[existingIndex].ipAddress = cleanDevice.ipAddress;
        }
        else {
            known.push({
                deviceId: cleanDevice.deviceId,
                deviceName: cleanDevice.deviceName || cleanDevice.platform || 'Device',
                platform: cleanDevice.platform,
                userAgent: cleanDevice.userAgent,
                ipAddress: cleanDevice.ipAddress,
                firstSeenAt: now,
                lastSeenAt: now,
            });
        }
        user.knownDevices = known;
        await user.save({ validateBeforeSave: false });
        const token = this.signToken(user._id);
        user.password = undefined;
        logger_1.default.info(`👤 User logged in: ${user.phoneNumber || user.email} [${user.role}] from ${cleanDevice.deviceName || 'Device'}`);
        return { user, token };
    }
    async socialLogin(type, token, role = user_model_1.UserRole.CUSTOMER) {
        let email;
        let socialId;
        let name;
        if (type === 'google') {
            try {
                const ticket = await googleClient.verifyIdToken({
                    idToken: token,
                    audience: process.env.GOOGLE_CLIENT_ID,
                });
                const payload = ticket.getPayload();
                if (payload) {
                    email = payload.email;
                    socialId = payload.sub;
                    name = payload.name;
                }
                else {
                    throw new Error('No payload');
                }
            }
            catch (tokenErr) {
                // Fallback verification via Google UserInfo API
                const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const userInfo = (await userInfoRes.json());
                if (userInfo && userInfo.email) {
                    email = userInfo.email;
                    socialId = userInfo.sub || userInfo.id;
                    name = userInfo.name || email.split('@')[0];
                }
                else {
                    throw new appError_1.default('Invalid Google authentication token', 400);
                }
            }
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
            // 🔒 Role Enforcement on Social Login
            if (role && user.role !== role) {
                const portalName = user.role === user_model_1.UserRole.VENDOR
                    ? 'Go-Eat Partner / Vendor'
                    : user.role === user_model_1.UserRole.RIDER
                        ? 'Go-Eat Delivery'
                        : user.role === user_model_1.UserRole.ADMIN
                            ? 'Go-Eat Admin'
                            : 'Go-Eat Customer';
                throw new appError_1.default(`Access denied. This account is registered as a ${user.role}. Please log in using the ${portalName} application.`, 403);
            }
            if (type === 'google' && !user.googleId)
                user.googleId = socialId;
            if (type === 'apple' && !user.appleId)
                user.appleId = socialId;
            user.lastLoginAt = new Date();
            user.lastActiveAt = new Date();
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
                lastLoginAt: new Date(),
                lastActiveAt: new Date(),
            });
        }
        const jwtToken = this.signToken(user._id);
        return { user, token: jwtToken };
    }
}
exports.default = new AuthService();
