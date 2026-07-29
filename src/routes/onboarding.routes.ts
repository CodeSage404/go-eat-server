import { Router } from 'express';
import {
  getMainOutlets,
  vendorStep1SelectOutlet,
  vendorStep2BusinessDetails,
  vendorStep3IdentityVerification,
  vendorStep4Compliance,
  riderRegisterOnboarding,
  getRiderOnboardingStatus,
} from '../controllers/onboarding.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

// Public / general endpoint to get outlets and their categories & requirements
router.get('/outlets', getMainOutlets);

// Protected routes for vendor & rider onboarding
router.use(protect);

// Vendor Onboarding Wizard routes
router.post('/vendor/step-1-outlet', restrictTo(UserRole.VENDOR, UserRole.ADMIN), vendorStep1SelectOutlet);
router.post('/vendor/step-2-details', restrictTo(UserRole.VENDOR, UserRole.ADMIN), vendorStep2BusinessDetails);
router.post('/vendor/step-3-identity', restrictTo(UserRole.VENDOR, UserRole.ADMIN), vendorStep3IdentityVerification);
router.post('/vendor/step-4-compliance', restrictTo(UserRole.VENDOR, UserRole.ADMIN), vendorStep4Compliance);

// Rider Onboarding Wizard routes
router.post('/rider/register', restrictTo(UserRole.RIDER, UserRole.ADMIN), riderRegisterOnboarding);
router.get('/rider/status', restrictTo(UserRole.RIDER, UserRole.ADMIN), getRiderOnboardingStatus);

export default router;
