"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const onboarding_controller_1 = require("../controllers/onboarding.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
// Public / general endpoint to get outlets and their categories & requirements
router.get('/outlets', onboarding_controller_1.getMainOutlets);
// Public route for landing page waitlist/registration
router.post('/interest', onboarding_controller_1.registerInterest);
// Protected routes for vendor & rider onboarding
router.use(auth_middleware_1.protect);
// Vendor Onboarding Wizard routes
router.post('/vendor/step-1-outlet', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), onboarding_controller_1.vendorStep1SelectOutlet);
router.post('/vendor/step-2-details', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), onboarding_controller_1.vendorStep2BusinessDetails);
router.post('/vendor/step-3-identity', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), onboarding_controller_1.vendorStep3IdentityVerification);
router.post('/vendor/step-4-compliance', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), onboarding_controller_1.vendorStep4Compliance);
// Rider Onboarding Wizard routes
router.post('/rider/register', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER, user_model_1.UserRole.ADMIN), onboarding_controller_1.riderRegisterOnboarding);
router.get('/rider/status', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER, user_model_1.UserRole.ADMIN), onboarding_controller_1.getRiderOnboardingStatus);
exports.default = router;
