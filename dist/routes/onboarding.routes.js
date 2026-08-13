"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const onboarding_controller_1 = require("../controllers/onboarding.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
// Public / general endpoint to get outlets and their categories & requirements
/**
 * @openapi
 * /api/v1/onboarding/outlets:
 *   get:
 *     tags:
 *       - Onboarding
 *     summary: Get available business outlets and their requirements
 *     responses:
 *       200:
 *         description: List of outlets
 */
router.get('/outlets', onboarding_controller_1.getMainOutlets);
// Public route for landing page waitlist/registration
/**
 * @openapi
 * /api/v1/onboarding/interest:
 *   post:
 *     tags:
 *       - Onboarding
 *     summary: Register interest for waitlist
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               businessName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Interest registered
 */
router.post('/interest', onboarding_controller_1.registerInterest);
// Protected routes for vendor & rider onboarding
router.use(auth_middleware_1.protect);
// Vendor Onboarding Wizard routes
/**
 * @openapi
 * /api/v1/onboarding/vendor/step-1-outlet:
 *   post:
 *     tags:
 *       - Onboarding
 *     summary: Vendor Onboarding Step 1 - Select Outlet
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Step 1 completed
 */
router.post('/vendor/step-1-outlet', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), onboarding_controller_1.vendorStep1SelectOutlet);
/**
 * @openapi
 * /api/v1/onboarding/vendor/step-2-details:
 *   post:
 *     tags:
 *       - Onboarding
 *     summary: Vendor Onboarding Step 2 - Business Details
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Step 2 completed
 */
router.post('/vendor/step-2-details', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), onboarding_controller_1.vendorStep2BusinessDetails);
/**
 * @openapi
 * /api/v1/onboarding/vendor/step-3-identity:
 *   post:
 *     tags:
 *       - Onboarding
 *     summary: Vendor Onboarding Step 3 - Identity Verification
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Step 3 completed
 */
router.post('/vendor/step-3-identity', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), onboarding_controller_1.vendorStep3IdentityVerification);
/**
 * @openapi
 * /api/v1/onboarding/vendor/step-4-compliance:
 *   post:
 *     tags:
 *       - Onboarding
 *     summary: Vendor Onboarding Step 4 - Compliance
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Step 4 completed
 */
router.post('/vendor/step-4-compliance', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), onboarding_controller_1.vendorStep4Compliance);
// Rider Onboarding Wizard routes
/**
 * @openapi
 * /api/v1/onboarding/rider/register:
 *   post:
 *     tags:
 *       - Onboarding
 *     summary: Rider Onboarding Registration
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rider onboarding registration completed
 */
router.post('/rider/register', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER, user_model_1.UserRole.ADMIN), onboarding_controller_1.riderRegisterOnboarding);
/**
 * @openapi
 * /api/v1/onboarding/rider/status:
 *   get:
 *     tags:
 *       - Onboarding
 *     summary: Get Rider Onboarding Status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rider onboarding status returned
 */
router.get('/rider/status', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER, user_model_1.UserRole.ADMIN), onboarding_controller_1.getRiderOnboardingStatus);
exports.default = router;
