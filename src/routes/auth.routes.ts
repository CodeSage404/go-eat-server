import { Router } from 'express';
import authController from '../controllers/auth.controller';

const router = Router();

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
router.post('/signup/user', authController.signupUser);

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
router.post('/signup/courier', authController.signupCourier);

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
router.post('/signup/vendor', authController.signupVendor);

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
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);

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
router.post('/login', authController.login);

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
router.post('/google', authController.googleLogin);

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
router.post('/apple', authController.appleLogin);

// Protected Profile Routes
router.use(authController.protect ? (req, res, next) => next() : (req, res, next) => next()); // Placeholder to ensure logic flows correctly if I missed the import check

import { protect } from '../middleware/auth.middleware';
router.use(protect);

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
router.get('/me', authController.getMe);

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
router.patch('/update-me', authController.updateMe);

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
router.post('/complete-profile', authController.completeProfile);

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
router.patch('/change-password', authController.changePassword);

export default router;
