"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = __importDefault(require("../controllers/auth.controller"));
const router = (0, express_1.Router)();
// Specialized Signup Routes
/**
 * @openapi
 * /api/v1/auth/signup/user:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Signup as Customer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber, password]
 *             properties:
 *               phoneNumber:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               referralCode:
 *                 type: string
 *     responses:
 *       201:
 *         description: Account created, verification OTP sent.
 */
router.post('/signup/user', auth_controller_1.default.signupUser);
/**
 * @openapi
 * /api/v1/auth/signup/courier:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Signup as Courier (Rider)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber, password, vehicleType, licenseNumber]
 *             properties:
 *               phoneNumber:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               referralCode:
 *                 type: string
 *               vehicleType:
 *                 type: string
 *               licenseNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: Courier account created.
 */
router.post('/signup/courier', auth_controller_1.default.signupCourier);
/**
 * @openapi
 * /api/v1/auth/signup/vendor:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Signup as Vendor (Restaurant Owner)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber, password, restaurantName, address, businessType]
 *             properties:
 *               phoneNumber:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               referralCode:
 *                 type: string
 *               restaurantName:
 *                 type: string
 *               address:
 *                 type: string
 *               businessType:
 *                 type: string
 *     responses:
 *       201:
 *         description: Vendor account created.
 */
router.post('/signup/vendor', auth_controller_1.default.signupVendor);
// Verification Routes
/**
 * @openapi
 * /api/v1/auth/verify-otp:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Verify Account with OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               email:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account verified.
 */
router.post('/verify-otp', auth_controller_1.default.verifyOTP);
router.post('/resend-otp', auth_controller_1.default.resendOTP);
// Shared Routes
/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: User Login
 *     description: Authenticate user and return a JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               phoneNumber:
 *                 type: string
 *                 example: "08012345678"
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Unauthorized
 */
router.post('/login', auth_controller_1.default.login);
/**
 * @openapi
 * /api/v1/auth/google:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Google Social Login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Google ID Token
 *               role:
 *                 type: string
 *                 enum: [customer, vendor, rider]
 *     responses:
 *       200:
 *         description: Social login successful.
 */
router.post('/google', auth_controller_1.default.googleLogin);
/**
 * @openapi
 * /api/v1/auth/apple:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Apple Social Login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Apple ID Token
 *               role:
 *                 type: string
 *                 enum: [customer, vendor, rider]
 *     responses:
 *       200:
 *         description: Social login successful.
 */
router.post('/apple', auth_controller_1.default.appleLogin);
// Protected Profile Routes
router.use(auth_controller_1.default.protect ? (req, res, next) => next() : (req, res, next) => next()); // Placeholder to ensure logic flows correctly if I missed the import check
const auth_middleware_1 = require("../middleware/auth.middleware");
router.use(auth_middleware_1.protect);
/**
 * @openapi
 * /api/v1/auth/me:
 *   get:
 *     tags:
 *       - User Profile
 *     summary: Get Logged-in User Profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile returned.
 */
router.get('/me', auth_controller_1.default.getMe);
/**
 * @openapi
 * /api/v1/auth/update-me:
 *   patch:
 *     tags:
 *       - User Profile
 *     summary: Update Current User Profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               notificationsEnabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Profile updated.
 */
router.patch('/update-me', auth_controller_1.default.updateMe);
/**
 * @openapi
 * /api/v1/auth/complete-profile:
 *   post:
 *     tags:
 *       - User Profile
 *     summary: Complete User Profile
 *     description: Allows user to set their fullname (name) and email address after phone registration, and triggers email verification.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Immanuel John
 *               email:
 *                 type: string
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Profile successfully completed / email OTP sent.
 */
router.post('/complete-profile', auth_controller_1.default.completeProfile);
/**
 * @openapi
 * /api/v1/auth/change-password:
 *   patch:
 *     tags:
 *       - Security
 *     summary: Change Password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed.
 */
router.patch('/change-password', auth_controller_1.default.changePassword);
exports.default = router;
