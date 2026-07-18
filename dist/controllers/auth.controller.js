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
const zod_1 = require("zod");
const auth_service_1 = __importDefault(require("../services/auth.service"));
const otp_util_1 = __importDefault(require("../utils/otp.util"));
const email_util_1 = __importDefault(require("../utils/email.util"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const user_model_1 = __importStar(require("../models/user.model"));
const logger_1 = __importDefault(require("../utils/logger"));
const twilioVerify_util_1 = require("../utils/twilioVerify.util");
const notification_service_1 = __importDefault(require("../services/notification.service"));
// Validation Schemas
const baseUserSignupSchema = zod_1.z.object({
    phoneNumber: zod_1.z.string().min(8, 'Phone number must be at least 8 digits').max(11, 'Phone number must be at most 11 digits').optional(),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    name: zod_1.z.string().optional(),
    email: zod_1.z.string().email('Invalid email address').optional(),
    referralCode: zod_1.z.string().optional(),
});
const userSignupSchema = baseUserSignupSchema.refine((data) => data.phoneNumber || data.email, {
    message: 'Either phone number or email is required',
    path: ['phoneNumber', 'email'],
});
const courierSignupSchema = baseUserSignupSchema.extend({
    vehicleType: zod_1.z.string().min(1, 'Vehicle type is required'),
    licenseNumber: zod_1.z.string().min(1, 'License number is required'),
}).refine((data) => data.phoneNumber || data.email, {
    message: 'Either phone number or email is required',
    path: ['phoneNumber', 'email'],
});
const vendorSignupSchema = baseUserSignupSchema.extend({
    restaurantName: zod_1.z.string().min(1, 'Restaurant name is required'),
    address: zod_1.z.string().min(1, 'Address is required'),
    businessType: zod_1.z.string().min(1, 'Business type is required'),
}).refine((data) => data.phoneNumber || data.email, {
    message: 'Either phone number or email is required',
    path: ['phoneNumber', 'email'],
});
const verifyOTPSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address').optional(),
    phoneNumber: zod_1.z.string().optional(),
    otp: zod_1.z.string().length(6, 'OTP must be 6 digits'),
});
const socialLoginSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token is required'),
    role: zod_1.z.nativeEnum(user_model_1.UserRole).optional(),
});
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, 'Current password is required'),
    newPassword: zod_1.z.string().min(8, 'New password must be at least 8 characters'),
});
const updateMeSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    phoneNumber: zod_1.z.string().optional(),
    notificationsEnabled: zod_1.z.boolean().optional(),
    location: zod_1.z.object({
        type: zod_1.z.literal('Point'),
        coordinates: zod_1.z.array(zod_1.z.number()).length(2),
    }).optional(),
});
class AuthController {
    constructor() {
        this.signupUser = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const validatedData = userSignupSchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default(validatedData.error.issues.map(i => i.message).join(', '), 400);
            }
            let referredBy;
            if (req.body.referralCode) {
                const referrer = await user_model_1.default.findOne({ referralCode: req.body.referralCode.toUpperCase() });
                if (referrer)
                    referredBy = referrer._id;
            }
            const { user, token } = await auth_service_1.default.register({
                ...req.body,
                role: user_model_1.UserRole.CUSTOMER,
                referredBy,
            });
            const verifyByPhone = !!user.phoneNumber;
            if (verifyByPhone) {
                await this.initiateVerification(user.phoneNumber, 'phone');
            }
            else if (user.email) {
                await this.initiateVerification(user.email, 'email');
            }
            else {
                throw new appError_1.default('Verification identifier missing', 400);
            }
            res.status(201).json({
                status: 'success',
                message: verifyByPhone
                    ? 'Signup successful. Please verify your phone number with the OTP.'
                    : 'Signup successful. Please verify your email with the OTP.',
                token,
                data: { user },
            });
        });
        this.signupCourier = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const validatedData = courierSignupSchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default(validatedData.error.issues.map(i => i.message).join(', '), 400);
            }
            let referredBy;
            if (req.body.referralCode) {
                const referrer = await user_model_1.default.findOne({ referralCode: req.body.referralCode.toUpperCase() });
                if (referrer)
                    referredBy = referrer._id;
            }
            const { user, token } = await auth_service_1.default.register({
                ...req.body,
                role: user_model_1.UserRole.RIDER,
                status: user_model_1.UserStatus.PENDING, // Couriers need verification
                referredBy,
            });
            const verifyByPhone = !!user.phoneNumber;
            if (verifyByPhone) {
                await this.initiateVerification(user.phoneNumber, 'phone');
            }
            else if (user.email) {
                await this.initiateVerification(user.email, 'email');
            }
            else {
                throw new appError_1.default('Verification identifier missing', 400);
            }
            res.status(201).json({
                status: 'success',
                message: verifyByPhone
                    ? 'Courier signup successful. Please verify your phone number.'
                    : 'Courier signup successful. Please verify your email.',
                token,
                data: { user },
            });
        });
        this.signupVendor = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const validatedData = vendorSignupSchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default(validatedData.error.issues.map(i => i.message).join(', '), 400);
            }
            let referredBy;
            if (req.body.referralCode) {
                const referrer = await user_model_1.default.findOne({ referralCode: req.body.referralCode.toUpperCase() });
                if (referrer)
                    referredBy = referrer._id;
            }
            const { user, token } = await auth_service_1.default.register({
                ...req.body,
                role: user_model_1.UserRole.VENDOR,
                status: user_model_1.UserStatus.PENDING, // Vendors need verification
                referredBy,
            });
            const verifyByPhone = !!user.phoneNumber;
            if (verifyByPhone) {
                await this.initiateVerification(user.phoneNumber, 'phone');
            }
            else if (user.email) {
                await this.initiateVerification(user.email, 'email');
            }
            else {
                throw new appError_1.default('Verification identifier missing', 400);
            }
            res.status(201).json({
                status: 'success',
                message: verifyByPhone
                    ? 'Vendor signup successful. Please verify your phone number.'
                    : 'Vendor signup successful. Please verify your email.',
                token,
                data: { user },
            });
        });
        this.verifyOTP = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const validatedData = verifyOTPSchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default('Invalid request details', 400);
            }
            const { email, phoneNumber, otp } = req.body;
            const identifier = email || phoneNumber;
            if (!identifier) {
                throw new appError_1.default('Please provide email or phone number', 400);
            }
            let isValid = false;
            if (phoneNumber) {
                isValid = await (0, twilioVerify_util_1.checkWhatsAppVerification)(phoneNumber, otp);
            }
            else if (email) {
                isValid = await otp_util_1.default.verifyOTP(email.toLowerCase(), otp);
            }
            if (!isValid) {
                throw new appError_1.default('Invalid or expired OTP', 400);
            }
            // Update user verification status based on query
            const query = email ? { email: email.toLowerCase() } : { phoneNumber };
            const user = await user_model_1.default.findOneAndUpdate(query, { isVerified: true }, { new: true });
            if (!user) {
                throw new appError_1.default('User not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: email ? 'Email verified successfully' : 'Phone number verified successfully',
                data: { user },
            });
        });
        this.login = (0, catchAsync_1.catchAsync)(async (req, res) => {
            // Allows either email or phone login
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
            const validatedData = socialLoginSchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default(validatedData.error.issues.map(i => i.message).join(', '), 400);
            }
            const { user, token } = await auth_service_1.default.socialLogin('google', req.body.token, req.body.role);
            res.status(200).json({
                status: 'success',
                token,
                data: { user },
            });
        });
        this.appleLogin = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const validatedData = socialLoginSchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default(validatedData.error.issues.map(i => i.message).join(', '), 400);
            }
            const { user, token } = await auth_service_1.default.socialLogin('apple', req.body.token, req.body.role);
            res.status(200).json({
                status: 'success',
                token,
                data: { user },
            });
        });
        // User Profile Methods
        this.getMe = (0, catchAsync_1.catchAsync)(async (req, res) => {
            res.status(200).json({
                status: 'success',
                data: { user: req.user },
            });
        });
        this.updateMe = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const validatedData = updateMeSchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default('Invalid update data', 400);
            }
            const updatedUser = await user_model_1.default.findByIdAndUpdate(req.user._id, req.body, { new: true, runValidators: true });
            res.status(200).json({
                status: 'success',
                data: { user: updatedUser },
            });
        });
        /**
         * Complete user profile: Add name, add email, and trigger verification OTP for the new email
         */
        this.completeProfile = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { name, email } = req.body;
            const user = await user_model_1.default.findById(req.user._id);
            if (!user)
                throw new appError_1.default('User not found', 404);
            if (name)
                user.name = name;
            if (email && email.toLowerCase() !== user.email) {
                // Check if this email is already registered by someone else
                const existingUser = await user_model_1.default.findOne({ email: email.toLowerCase() });
                if (existingUser) {
                    throw new appError_1.default('Email is already registered by another user', 400);
                }
                user.email = email.toLowerCase();
                // Trigger email verification
                await this.initiateVerification(user.email, 'email');
            }
            await user.save();
            res.status(200).json({
                status: 'success',
                message: email ? 'Profile updated. Please verify the new email with the OTP sent.' : 'Profile completed successfully.',
                data: { user },
            });
        });
        this.changePassword = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const validatedData = changePasswordSchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default(validatedData.error.issues[0].message, 400);
            }
            const user = await user_model_1.default.findById(req.user._id).select('+password');
            if (!user || !(await user.comparePassword(req.body.currentPassword))) {
                throw new appError_1.default('Current password is incorrect', 401);
            }
            user.password = req.body.newPassword;
            await user.save();
            res.status(200).json({
                status: 'success',
                message: 'Password updated successfully',
            });
        });
    }
    async initiateVerification(identifier, type) {
        if (type === 'email') {
            const otp = otp_util_1.default.generateOTP();
            await otp_util_1.default.storeOTP(identifier, otp);
            await email_util_1.default.sendOTP(identifier, otp);
        }
        else {
            // Send real WhatsApp OTP via Twilio Verify API v2
            await (0, twilioVerify_util_1.startWhatsAppVerification)(identifier);
            // Also send via Push Notification if FCM is available on device
            try {
                const user = await user_model_1.default.findOne({ phoneNumber: identifier });
                if (user && user.fcmToken) {
                    await notification_service_1.default.sendNotification(user._id.toString(), 'Phone Verification OTP 🔑', 'Your verification code has been sent to your WhatsApp.');
                }
            }
            catch (err) {
                logger_1.default.error('Failed to dispatch OTP via push notification:', err);
            }
        }
    }
}
exports.default = new AuthController();
