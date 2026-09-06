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
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const auth_service_1 = __importDefault(require("../services/auth.service"));
const user_model_1 = __importStar(require("../models/user.model"));
const otp_util_1 = __importDefault(require("../utils/otp.util"));
const email_service_1 = __importDefault(require("../services/email.service"));
const logger_1 = __importDefault(require("../utils/logger"));
const twilioVerify_util_1 = require("../utils/twilioVerify.util");
class AuthController {
    constructor() {
        this.signupUser = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { email, phoneNumber, password } = req.body;
            if (!password || (!email && !phoneNumber)) {
                throw new appError_1.default('Please provide email or phone number along with password', 400);
            }
            let referredBy;
            if (req.body.referralCode) {
                const referrer = await user_model_1.default.findOne({ referralCode: req.body.referralCode.toUpperCase() });
                if (referrer)
                    referredBy = referrer._id;
            }
            // Validate uniqueness against existing VERIFIED users (does NOT write to DB yet)
            const cleanData = await auth_service_1.default.validateUniqueness({
                ...req.body,
                role: user_model_1.UserRole.CUSTOMER,
                referredBy,
            });
            const identifier = cleanData.email || cleanData.phoneNumber;
            if (!identifier) {
                throw new appError_1.default('Verification identifier missing', 400);
            }
            // Cache pending registration in Redis for 10 minutes (stored under raw identifier and all phone variations)
            await otp_util_1.default.storePendingUser(identifier, cleanData, 600);
            if (cleanData.phoneNumber) {
                const e164 = (0, twilioVerify_util_1.formatPhoneNumber)(cleanData.phoneNumber);
                const local = cleanData.phoneNumber.startsWith('+234')
                    ? '0' + cleanData.phoneNumber.slice(4)
                    : cleanData.phoneNumber;
                await otp_util_1.default.storePendingUser(e164, cleanData, 600);
                await otp_util_1.default.storePendingUser(local, cleanData, 600);
            }
            // Dispatch verification OTP via both email and phone
            const dispatchResult = await this.initiateVerification(cleanData.email, cleanData.phoneNumber);
            res.status(200).json({
                status: 'success',
                message: `Signup details saved. A fresh verification code has been sent via ${dispatchResult.channel}.`,
                data: {
                    channel: dispatchResult.channel,
                    remainingAttempts: dispatchResult.remaining,
                },
            });
        });
        this.signupCourier = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { email, phoneNumber, password } = req.body;
            if (!password || (!email && !phoneNumber)) {
                throw new appError_1.default('Please provide email or phone number along with password', 400);
            }
            let referredBy;
            if (req.body.referralCode) {
                const referrer = await user_model_1.default.findOne({ referralCode: req.body.referralCode.toUpperCase() });
                if (referrer)
                    referredBy = referrer._id;
            }
            const cleanData = await auth_service_1.default.validateUniqueness({
                ...req.body,
                role: user_model_1.UserRole.RIDER,
                status: user_model_1.UserStatus.PENDING,
                referredBy,
            });
            const identifier = cleanData.email || cleanData.phoneNumber;
            if (!identifier) {
                throw new appError_1.default('Verification identifier missing', 400);
            }
            await otp_util_1.default.storePendingUser(identifier, cleanData, 600);
            if (cleanData.phoneNumber) {
                const e164 = (0, twilioVerify_util_1.formatPhoneNumber)(cleanData.phoneNumber);
                const local = cleanData.phoneNumber.startsWith('+234')
                    ? '0' + cleanData.phoneNumber.slice(4)
                    : cleanData.phoneNumber;
                await otp_util_1.default.storePendingUser(e164, cleanData, 600);
                await otp_util_1.default.storePendingUser(local, cleanData, 600);
            }
            const dispatchResult = await this.initiateVerification(cleanData.email, cleanData.phoneNumber);
            res.status(200).json({
                status: 'success',
                message: `Courier signup details saved. A fresh verification code has been sent via ${dispatchResult.channel}.`,
                data: {
                    channel: dispatchResult.channel,
                    remainingAttempts: dispatchResult.remaining,
                },
            });
        });
        this.signupVendor = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { email, phoneNumber, password } = req.body;
            if (!password || (!email && !phoneNumber)) {
                throw new appError_1.default('Please provide email or phone number along with password', 400);
            }
            let referredBy;
            if (req.body.referralCode) {
                const referrer = await user_model_1.default.findOne({ referralCode: req.body.referralCode.toUpperCase() });
                if (referrer)
                    referredBy = referrer._id;
            }
            const cleanData = await auth_service_1.default.validateUniqueness({
                ...req.body,
                role: user_model_1.UserRole.VENDOR,
                status: user_model_1.UserStatus.PENDING,
                referredBy,
            });
            const identifier = cleanData.email || cleanData.phoneNumber;
            if (!identifier) {
                throw new appError_1.default('Verification identifier missing', 400);
            }
            await otp_util_1.default.storePendingUser(identifier, cleanData, 600);
            if (cleanData.phoneNumber) {
                const e164 = (0, twilioVerify_util_1.formatPhoneNumber)(cleanData.phoneNumber);
                const local = cleanData.phoneNumber.startsWith('+234')
                    ? '0' + cleanData.phoneNumber.slice(4)
                    : cleanData.phoneNumber;
                await otp_util_1.default.storePendingUser(e164, cleanData, 600);
                await otp_util_1.default.storePendingUser(local, cleanData, 600);
            }
            const dispatchResult = await this.initiateVerification(cleanData.email, cleanData.phoneNumber);
            res.status(200).json({
                status: 'success',
                message: `Vendor signup details saved. A fresh verification code has been sent via ${dispatchResult.channel}.`,
                data: {
                    channel: dispatchResult.channel,
                    remainingAttempts: dispatchResult.remaining,
                },
            });
        });
        this.verifyOTP = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { email, phoneNumber, otp } = req.body;
            const identifier = email || phoneNumber;
            if (!identifier || !otp) {
                throw new appError_1.default('Please provide email or phone number and OTP code', 400);
            }
            let isValid = false;
            if (phoneNumber) {
                isValid = await (0, twilioVerify_util_1.checkWhatsAppVerification)(phoneNumber, otp);
            }
            else if (email) {
                isValid = await otp_util_1.default.verifyOTP(email.toLowerCase(), otp);
            }
            if (!isValid) {
                throw new appError_1.default('Invalid or expired OTP code', 400);
            }
            // Reset OTP request rate limit upon successful verification
            await otp_util_1.default.resetRequestLimit(identifier);
            let user;
            let token;
            // Check if there is a pending registration payload cached in Redis across all phone variations
            let pendingUserData = await otp_util_1.default.getPendingUser(identifier);
            if (!pendingUserData && phoneNumber) {
                const e164 = (0, twilioVerify_util_1.formatPhoneNumber)(phoneNumber);
                const local = phoneNumber.startsWith('+234') ? '0' + phoneNumber.slice(4) : phoneNumber;
                pendingUserData = (await otp_util_1.default.getPendingUser(e164)) || (await otp_util_1.default.getPendingUser(local));
            }
            if (pendingUserData) {
                // NOW save the verified user document into MongoDB
                const result = await auth_service_1.default.createVerifiedUser(pendingUserData);
                user = result.user;
                token = result.token;
                await otp_util_1.default.deletePendingUser(identifier);
                if (phoneNumber) {
                    await otp_util_1.default.deletePendingUser((0, twilioVerify_util_1.formatPhoneNumber)(phoneNumber));
                    const local = phoneNumber.startsWith('+234') ? '0' + phoneNumber.slice(4) : phoneNumber;
                    await otp_util_1.default.deletePendingUser(local);
                }
            }
            else {
                // Update existing DB user if already present
                const query = email
                    ? { email: email.toLowerCase() }
                    : {
                        $or: [
                            { phoneNumber },
                            { phoneNumber: (0, twilioVerify_util_1.formatPhoneNumber)(phoneNumber) },
                            { phoneNumber: phoneNumber.startsWith('+234') ? '0' + phoneNumber.slice(4) : phoneNumber },
                        ],
                    };
                user = await user_model_1.default.findOneAndUpdate(query, { isVerified: true }, { returnDocument: 'after' });
                if (!user) {
                    throw new appError_1.default('User registration not found. Please sign up again.', 404);
                }
                token = auth_service_1.default.signToken(user._id);
            }
            // Send welcome email if user has an email address
            if (user.email) {
                try {
                    await email_service_1.default.sendTemplateEmail(user.email, 'WELCOME_USER', 'Welcome to Go-Eat!', { name: user.name || 'User' });
                }
                catch (err) {
                    logger_1.default.error(`Error sending welcome email to ${user.email}:`, err.message);
                }
            }
            // Return success response with token and verified user
            res.status(200).json({
                status: 'success',
                token,
                data: { user },
                message: email
                    ? 'Email verified successfully.'
                    : 'Phone number verified successfully.',
            });
        });
        this.resendOTP = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { email, phoneNumber } = req.body;
            const identifier = email || phoneNumber;
            if (!identifier) {
                throw new appError_1.default('Please provide an email or phone number to resend OTP', 400);
            }
            const dispatchResult = await this.initiateVerification(email, phoneNumber);
            res.status(200).json({
                status: 'success',
                message: `A fresh verification code has been sent via ${dispatchResult.channel}. (${dispatchResult.remaining} resend attempts remaining).`,
                data: {
                    channel: dispatchResult.channel,
                    remainingAttempts: dispatchResult.remaining,
                },
            });
        });
        this.login = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { email, phoneNumber, password } = req.body;
            const identifier = email || phoneNumber;
            const { user, token } = await auth_service_1.default.login(identifier, password);
            res.status(200).json({
                status: 'success',
                token,
                data: { user },
            });
        });
        this.googleLogin = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { token, role } = req.body;
            if (!token)
                throw new appError_1.default('Google token is required', 400);
            const result = await auth_service_1.default.socialLogin('google', token, role || user_model_1.UserRole.CUSTOMER);
            res.status(200).json({
                status: 'success',
                token: result.token,
                data: { user: result.user },
            });
        });
        this.appleLogin = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { token, role } = req.body;
            if (!token)
                throw new appError_1.default('Apple token is required', 400);
            const result = await auth_service_1.default.socialLogin('apple', token, role || user_model_1.UserRole.CUSTOMER);
            res.status(200).json({
                status: 'success',
                token: result.token,
                data: { user: result.user },
            });
        });
        this.getMe = (0, catchAsync_1.catchAsync)(async (req, res) => {
            res.status(200).json({
                status: 'success',
                data: { user: req.user },
            });
        });
        this.updateMe = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const allowedFields = ['name', 'phoneNumber', 'notificationsEnabled', 'profileImage'];
            const filteredBody = {};
            Object.keys(req.body).forEach(key => {
                if (allowedFields.includes(key)) {
                    filteredBody[key] = req.body[key];
                }
            });
            const currentUser = req.user;
            const updatedUser = await user_model_1.default.findByIdAndUpdate(currentUser._id, filteredBody, {
                returnDocument: 'after',
                runValidators: true,
            });
            res.status(200).json({
                status: 'success',
                data: { user: updatedUser },
            });
        });
        this.completeProfile = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { name, email } = req.body;
            const currentUser = req.user;
            if (!name || !email) {
                throw new appError_1.default('Please provide both full name and email', 400);
            }
            const lowerEmail = email.toLowerCase().trim();
            const existingUser = await user_model_1.default.findOne({ email: lowerEmail, _id: { $ne: currentUser._id } });
            if (existingUser && existingUser.isVerified) {
                throw new appError_1.default('Email is already registered by another account', 400);
            }
            const updatedUser = await user_model_1.default.findByIdAndUpdate(currentUser._id, { name: name.trim(), email: lowerEmail }, { returnDocument: 'after', runValidators: true });
            if (!updatedUser) {
                throw new appError_1.default('User profile update failed', 400);
            }
            const otp = otp_util_1.default.generateOTP();
            await otp_util_1.default.storeOTP(lowerEmail, otp);
            await email_service_1.default.sendOTP(lowerEmail, otp);
            res.status(200).json({
                status: 'success',
                message: 'Profile details saved. Verification OTP dispatched to email.',
                data: { user: updatedUser },
            });
        });
        this.changePassword = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { currentPassword, newPassword } = req.body;
            const currentUser = req.user;
            if (!currentPassword || !newPassword) {
                throw new appError_1.default('Please provide current password and new password', 400);
            }
            const user = await user_model_1.default.findById(currentUser._id).select('+password');
            if (!user || !(await user.comparePassword(currentPassword))) {
                throw new appError_1.default('Current password is incorrect', 401);
            }
            user.password = newPassword;
            user.hasChangedPassword = true;
            await user.save();
            const token = auth_service_1.default.signToken(user._id);
            res.status(200).json({
                status: 'success',
                message: 'Password updated successfully',
                token,
            });
        });
        this.forgotPassword = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { email, phoneNumber } = req.body;
            const identifier = email || phoneNumber;
            if (!identifier) {
                throw new appError_1.default('Please provide email or phone number', 400);
            }
            const query = email ? { email: email.toLowerCase() } : { phoneNumber };
            const user = await user_model_1.default.findOne(query);
            if (!user) {
                throw new appError_1.default('No user found with that email or phone number', 404);
            }
            if (phoneNumber) {
                await this.initiateVerification(phoneNumber, 'phone');
            }
            else if (email) {
                await this.initiateVerification(email.toLowerCase(), 'email');
            }
            res.status(200).json({
                status: 'success',
                message: 'OTP sent successfully. Please check your messages.',
            });
        });
        this.resetPassword = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { email, phoneNumber, otp, newPassword } = req.body;
            const identifier = email || phoneNumber;
            if (!identifier || !otp || !newPassword) {
                throw new appError_1.default('Please provide identifier, otp, and newPassword', 400);
            }
            let isValid = false;
            if (phoneNumber) {
                isValid = await (0, twilioVerify_util_1.checkWhatsAppVerification)(phoneNumber, otp);
            }
            else if (email) {
                isValid = await otp_util_1.default.verifyOTP(email.toLowerCase(), otp);
            }
            if (!isValid) {
                throw new appError_1.default('Invalid or expired OTP code', 400);
            }
            const query = email ? { email: email.toLowerCase() } : { phoneNumber };
            const user = await user_model_1.default.findOne(query).select('+password');
            if (!user) {
                throw new appError_1.default('User not found', 404);
            }
            user.password = newPassword;
            await user.save();
            res.status(200).json({
                status: 'success',
                message: 'Password reset successful. You can now log in.',
            });
        });
        this.updateUserLocation = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { address, coordinates, country, countryCode, isNigeria, isItaly, isUk } = req.body;
            const currentUser = req.user;
            if (!address || !coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
                throw new appError_1.default('Address string and coordinates array [lng, lat] are required', 400);
            }
            const lng = Number(coordinates[0]);
            const lat = Number(coordinates[1]);
            let resolvedCountry = country;
            let resolvedCode = countryCode;
            if (!resolvedCountry) {
                const lowerAddr = address.toLowerCase();
                if (lowerAddr.includes('italy') ||
                    lowerAddr.includes('italia') ||
                    (lat >= 36.0 && lat <= 47.5 && lng >= 6.5 && lng <= 18.5)) {
                    resolvedCountry = 'Italy';
                    resolvedCode = 'IT';
                }
                else if (lowerAddr.includes('united kingdom') ||
                    lowerAddr.includes('uk') ||
                    lowerAddr.includes('england') ||
                    lowerAddr.includes('london') ||
                    (lat >= 49.5 && lat <= 61.0 && lng >= -8.5 && lng <= 2.0)) {
                    resolvedCountry = 'UK';
                    resolvedCode = 'UK';
                }
                else {
                    resolvedCountry = 'Nigeria';
                    resolvedCode = 'NG';
                }
            }
            const updatePayload = {
                location: {
                    type: 'Point',
                    coordinates: [lng, lat],
                },
                country: resolvedCountry,
                countryCode: resolvedCode || 'NG',
                isNigeria: isNigeria !== undefined ? isNigeria : resolvedCountry === 'Nigeria',
                isItaly: isItaly !== undefined ? isItaly : resolvedCountry === 'Italy',
                isUk: isUk !== undefined ? isUk : resolvedCountry === 'UK',
            };
            const updatedUser = await user_model_1.default.findByIdAndUpdate(currentUser._id, updatePayload, { returnDocument: 'after' });
            logger_1.default.info(`📍 Location persisted to DB for user ${currentUser._id}: ${address} (${lng}, ${lat}) [Country: ${resolvedCountry}]`);
            res.status(200).json({
                status: 'success',
                message: 'User location saved to database successfully',
                data: { user: updatedUser },
            });
        });
    }
    async initiateVerification(email, phoneNumber) {
        const primaryId = email || phoneNumber || '';
        if (!primaryId) {
            throw new appError_1.default('Verification identifier missing', 400);
        }
        // Check and enforce OTP request rate limit (Max 6 attempts per identifier per 30 minutes)
        const { allowed, count, remaining } = await otp_util_1.default.checkAndIncrementRequestLimit(primaryId, 6, 1800);
        if (!allowed) {
            throw new appError_1.default('You have exceeded the maximum limit of 6 OTP requests for this account. Please wait 30 minutes before requesting another code or sign up using an alternative email address.', 429);
        }
        // 1. Generate ONE single, shared 6-digit OTP code
        const otp = otp_util_1.default.generateOTP();
        const deliveredChannels = [];
        // 2. If email is provided, store in Redis and dispatch via Brevo/SMTP immediately
        if (email) {
            const cleanEmail = email.toLowerCase().trim();
            await otp_util_1.default.storeOTP(cleanEmail, otp);
            try {
                await email_service_1.default.sendOTP(cleanEmail, otp);
                deliveredChannels.push('email');
                logger_1.default.info(`📧 Verification OTP (${otp}) dispatched via email to ${cleanEmail}`);
            }
            catch (err) {
                logger_1.default.warn(`⚠️ Failed to send verification email to ${cleanEmail}:`, err.message);
            }
        }
        // 3. If phone is provided, store across all phone formats in Redis and dispatch via Twilio (WhatsApp & SMS)
        if (phoneNumber) {
            const formattedPhone = (0, twilioVerify_util_1.formatPhoneNumber)(phoneNumber);
            try {
                const phoneResult = await (0, twilioVerify_util_1.startWhatsAppVerification)(formattedPhone, otp);
                if (phoneResult.channel !== 'redis') {
                    deliveredChannels.push(phoneResult.channel);
                }
            }
            catch (err) {
                logger_1.default.warn(`⚠️ Phone verification note for ${formattedPhone}:`, err.message);
            }
        }
        let channelText = 'email and phone';
        if (deliveredChannels.includes('email') && (deliveredChannels.includes('whatsapp') || deliveredChannels.includes('sms'))) {
            channelText = 'email and phone';
        }
        else if (deliveredChannels.includes('email')) {
            channelText = 'email';
        }
        else if (deliveredChannels.includes('whatsapp')) {
            channelText = 'WhatsApp';
        }
        else if (deliveredChannels.includes('sms')) {
            channelText = 'SMS';
        }
        else {
            channelText = email ? 'email' : 'phone';
        }
        return { channel: channelText, remaining };
    }
}
exports.default = new AuthController();
