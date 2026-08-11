import { Router } from 'express';
import {
  getMainOutlets,
  vendorStep1SelectOutlet,
  vendorStep2BusinessDetails,
  vendorStep3IdentityVerification,
  vendorStep4Compliance,
  riderRegisterOnboarding,
  getRiderOnboardingStatus,
  registerInterest,
} from '../controllers/onboarding.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

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
router.get('/outlets', getMainOutlets);

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
router.post('/interest', registerInterest);

// Protected routes for vendor & rider onboarding
router.use(protect);

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
router.post('/vendor/step-1-outlet', restrictTo(UserRole.VENDOR, UserRole.ADMIN), vendorStep1SelectOutlet);

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
router.post('/vendor/step-2-details', restrictTo(UserRole.VENDOR, UserRole.ADMIN), vendorStep2BusinessDetails);

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
router.post('/vendor/step-3-identity', restrictTo(UserRole.VENDOR, UserRole.ADMIN), vendorStep3IdentityVerification);

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
router.post('/vendor/step-4-compliance', restrictTo(UserRole.VENDOR, UserRole.ADMIN), vendorStep4Compliance);

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
router.post('/rider/register', restrictTo(UserRole.RIDER, UserRole.ADMIN), riderRegisterOnboarding);

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
router.get('/rider/status', restrictTo(UserRole.RIDER, UserRole.ADMIN), getRiderOnboardingStatus);

export default router;
