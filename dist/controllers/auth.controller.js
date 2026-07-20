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
            // Cache pending registration in Redis for 10 minutes
            await otp_util_1.default.storePendingUser(identifier, cleanData, 600);
            // Send OTP (If email/phone sending fails, error is thrown BEFORE DB creation)
            const verifyByPhone = !!cleanData.phoneNumber;
            if (verifyByPhone) {
                await this.initiateVerification(cleanData.phoneNumber, 'phone');
            }
            else if (cleanData.email) {
                await this.initiateVerification(cleanData.email, 'email');
            }
            res.status(200).json({
                status: 'success',
                message: verifyByPhone
                    ? 'Signup payload saved. Please verify your phone number with the OTP code.'
                    : 'Signup payload saved. Please verify your email with the OTP code.',
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
            const verifyByPhone = !!cleanData.phoneNumber;
            if (verifyByPhone) {
                await this.initiateVerification(cleanData.phoneNumber, 'phone');
            }
            else if (cleanData.email) {
                await this.initiateVerification(cleanData.email, 'email');
            }
            res.status(200).json({
                status: 'success',
                message: verifyByPhone
                    ? 'Courier signup payload saved. Please verify your phone number.'
                    : 'Courier signup payload saved. Please verify your email.',
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
            const verifyByPhone = !!cleanData.phoneNumber;
            if (verifyByPhone) {
                await this.initiateVerification(cleanData.phoneNumber, 'phone');
            }
            else if (cleanData.email) {
                await this.initiateVerification(cleanData.email, 'email');
            }
            res.status(200).json({
                status: 'success',
                message: verifyByPhone
                    ? 'Vendor signup payload saved. Please verify your phone number.'
                    : 'Vendor signup payload saved. Please verify your email.',
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
            let user;
            // Check if there is a pending registration payload cached in Redis
            const pendingUserData = await otp_util_1.default.getPendingUser(identifier);
            if (pendingUserData) {
                // NOW save the verified user document into MongoDB
                const result = await auth_service_1.default.createVerifiedUser(pendingUserData);
                user = result.user;
                await otp_util_1.default.deletePendingUser(identifier);
            }
            else {
                // Update existing DB user if already present
                const query = email ? { email: email.toLowerCase() } : { phoneNumber };
                user = await user_model_1.default.findOneAndUpdate(query, { isVerified: true }, { new: true });
                if (!user) {
                    throw new appError_1.default('User registration not found. Please sign up again.', 404);
                }
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
            // Return success message requiring user to log in to obtain a JWT token
            res.status(200).json({
                status: 'success',
                message: email
                    ? 'Email verified successfully. Please log in with your credentials to continue.'
                    : 'Phone number verified successfully. Please log in with your credentials to continue.',
            });
        });
        this.resendOTP = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { email, phoneNumber } = req.body;
            const identifier = email || phoneNumber;
            if (!identifier) {
                throw new appError_1.default('Please provide an email or phone number to resend OTP', 400);
            }
            if (phoneNumber) {
                await this.initiateVerification(phoneNumber, 'phone');
            }
            else if (email) {
                await this.initiateVerification(email, 'email');
            }
            res.status(200).json({
                status: 'success',
                message: phoneNumber
                    ? 'Verification OTP code resent successfully to your WhatsApp.'
                    : 'Verification OTP code resent successfully to your email address.',
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
            const allowedFields = ['name', 'phoneNumber', 'notificationsEnabled'];
            const filteredBody = {};
            Object.keys(req.body).forEach(key => {
                if (allowedFields.includes(key)) {
                    filteredBody[key] = req.body[key];
                }
            });
            const currentUser = req.user;
            const updatedUser = await user_model_1.default.findByIdAndUpdate(currentUser._id, filteredBody, {
                new: true,
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
            const updatedUser = await user_model_1.default.findByIdAndUpdate(currentUser._id, { name: name.trim(), email: lowerEmail }, { new: true, runValidators: true });
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
            await user.save();
            const token = auth_service_1.default.signToken(user._id);
            res.status(200).json({
                status: 'success',
                message: 'Password updated successfully',
                token,
            });
        });
        this.updateUserLocation = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { address, coordinates } = req.body;
            const currentUser = req.user;
            if (!address || !coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
                throw new appError_1.default('Address string and coordinates array [lng, lat] are required', 400);
            }
            const lng = Number(coordinates[0]);
            const lat = Number(coordinates[1]);
            const updatedUser = await user_model_1.default.findByIdAndUpdate(currentUser._id, {
                location: {
                    type: 'Point',
                    coordinates: [lng, lat],
                },
            }, { new: true });
            logger_1.default.info(`📍 Location persisted to DB for user ${currentUser._id}: ${address} (${lng}, ${lat})`);
            res.status(200).json({
                status: 'success',
                message: 'User location saved to database successfully',
                data: { user: updatedUser },
            });
        });
    }
    async initiateVerification(identifier, type) {
        if (type === 'email') {
            const otp = otp_util_1.default.generateOTP();
            await otp_util_1.default.storeOTP(identifier, otp);
            await email_service_1.default.sendOTP(identifier, otp);
        }
        else {
            const formattedPhone = identifier.startsWith('+') ? identifier : `+234${identifier.replace(/^0/, '')}`;
            await (0, twilioVerify_util_1.startWhatsAppVerification)(formattedPhone);
        }
    }
}
exports.default = new AuthController();
