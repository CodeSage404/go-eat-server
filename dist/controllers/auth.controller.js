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
// Validation Schemas
const userSignupSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name is too short'),
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    phoneNumber: zod_1.z.string().optional(),
});
const courierSignupSchema = userSignupSchema.extend({
    vehicleType: zod_1.z.string().min(1, 'Vehicle type is required'),
    licenseNumber: zod_1.z.string().min(1, 'License number is required'),
});
const vendorSignupSchema = userSignupSchema.extend({
    restaurantName: zod_1.z.string().min(1, 'Restaurant name is required'),
    address: zod_1.z.string().min(1, 'Address is required'),
    businessType: zod_1.z.string().min(1, 'Business type is required'),
});
const verifyOTPSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
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
});
class AuthController {
    constructor() {
        this.signupUser = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const validatedData = userSignupSchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default(validatedData.error.issues.map(i => i.message).join(', '), 400);
            }
            const { user, token } = await auth_service_1.default.register({
                ...req.body,
                role: user_model_1.UserRole.CUSTOMER,
            });
            await this.initiateVerification(user.email);
            res.status(201).json({
                status: 'success',
                message: 'Signup successful. Please check your email for the OTP.',
                token,
                data: { user },
            });
        });
        this.signupCourier = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const validatedData = courierSignupSchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default(validatedData.error.issues.map(i => i.message).join(', '), 400);
            }
            const { user, token } = await auth_service_1.default.register({
                ...req.body,
                role: user_model_1.UserRole.RIDER,
                status: user_model_1.UserStatus.PENDING, // Couriers need verification
            });
            await this.initiateVerification(user.email);
            res.status(201).json({
                status: 'success',
                message: 'Courier signup successful. Please verify your email.',
                token,
                data: { user },
            });
        });
        this.signupVendor = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const validatedData = vendorSignupSchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default(validatedData.error.issues.map(i => i.message).join(', '), 400);
            }
            const { user, token } = await auth_service_1.default.register({
                ...req.body,
                role: user_model_1.UserRole.VENDOR,
                status: user_model_1.UserStatus.PENDING, // Vendors need verification
            });
            await this.initiateVerification(user.email);
            res.status(201).json({
                status: 'success',
                message: 'Vendor signup successful. Please verify your email.',
                token,
                data: { user },
            });
        });
        this.verifyOTP = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const validatedData = verifyOTPSchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default('Invalid request details', 400);
            }
            const { email, otp } = req.body;
            const isValid = await otp_util_1.default.verifyOTP(email, otp);
            if (!isValid) {
                throw new appError_1.default('Invalid or expired OTP', 400);
            }
            // Update user verification status
            const user = await user_model_1.default.findOneAndUpdate({ email }, { isVerified: true }, { new: true });
            if (!user) {
                throw new appError_1.default('User not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: 'Email verified successfully',
                data: { user },
            });
        });
        this.login = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { user, token } = await auth_service_1.default.login(req.body.email, req.body.password);
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
            // req.user is set by the protect middleware
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
    async initiateVerification(email) {
        const otp = otp_util_1.default.generateOTP();
        await otp_util_1.default.storeOTP(email, otp);
        await email_util_1.default.sendOTP(email, otp);
    }
}
exports.default = new AuthController();
