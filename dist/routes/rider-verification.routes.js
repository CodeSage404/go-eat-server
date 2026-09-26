"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rider_verification_controller_1 = __importDefault(require("../controllers/rider-verification.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
// All rider verification routes require authentication
router.use(auth_middleware_1.protect);
/**
 * @openapi
 * /api/v1/riders/verification:
 *   get:
 *     tags:
 *       - Rider Verification
 *     summary: Get courier verification status and dynamic requirements checklist
 *     description: Retrieves the current authenticated rider's verification progress, submitted details, account status, and dynamic document requirements based on vehicle type (e.g. bicycle vs motorcycle/car).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification details and dynamic checklist retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     verification:
 *                       type: object
 *                     checklist:
 *                       type: object
 *                       properties:
 *                         personalDetails:
 *                           type: boolean
 *                         identityNIN:
 *                           type: boolean
 *                         selfieMatch:
 *                           type: boolean
 *                         deliveryMethod:
 *                           type: boolean
 *                         drivingLicense:
 *                           type: boolean
 *                         vehicleDetails:
 *                           type: boolean
 *                         vehiclePhoto:
 *                           type: boolean
 *                         registrationOwnership:
 *                           type: boolean
 *                         insuranceEvidence:
 *                           type: boolean
 *                         roadworthinessInspection:
 *                           type: boolean
 *                         payoutAccount:
 *                           type: boolean
 *                         safetyOperational:
 *                           type: boolean
 *                         riderAgreements:
 *                           type: boolean
 *                     userStatus:
 *                       type: string
 *                     riderVerificationStatus:
 *                       type: string
 *                       enum: [unsubmitted, under_review, action_required, approved, rejected]
 *                     hasSkippedRiderOnboarding:
 *                       type: boolean
 *       401:
 *         description: Unauthorized. Missing or invalid bearer token.
 */
router.get('/verification', rider_verification_controller_1.default.getRiderVerification);
/**
 * @openapi
 * /api/v1/riders/verification/submit:
 *   post:
 *     tags:
 *       - Rider Verification
 *     summary: Save rider verification progress or submit final application for admin review
 *     description: Saves draft step progress or performs strict validation across personal details, identity, vehicle documents, and bank details when isFinalSubmit is true.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isFinalSubmit:
 *                 type: boolean
 *                 description: Set to true when the rider is submitting for final admin review
 *                 example: false
 *               currentStep:
 *                 type: number
 *                 example: 2
 *               fullName:
 *                 type: string
 *                 example: John Doe
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348012345678"
 *               emailAddress:
 *                 type: string
 *                 example: "rider@example.com"
 *               residentialAddress:
 *                 type: string
 *                 example: "12 Marina Road, Lagos Island, Lagos"
 *               dob:
 *                 type: string
 *                 example: "1995-05-15"
 *               deliveryMethod:
 *                 type: string
 *                 enum: [bicycle, ebike, motorcycle, car]
 *                 example: motorcycle
 *               emergencyContact:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   relationship:
 *                     type: string
 *               ninVerification:
 *                 type: object
 *                 properties:
 *                   nin:
 *                     type: string
 *                     example: "12345678901"
 *                   verifiedName:
 *                     type: string
 *                   status:
 *                     type: string
 *               vehicle:
 *                 type: object
 *                 properties:
 *                   make:
 *                     type: string
 *                   model:
 *                     type: string
 *                   color:
 *                     type: string
 *                   registrationNumber:
 *                     type: string
 *                   vehiclePhotoUrl:
 *                     type: string
 *                   vehicleLicenseUrl:
 *                     type: string
 *                   insuranceCertificateUrl:
 *                     type: string
 *                   roadWorthinessCertificateUrl:
 *                     type: string
 *               documents:
 *                 type: object
 *                 properties:
 *                   ninDoc:
 *                     type: string
 *                   driverLicense:
 *                     type: string
 *                   riderPhoto:
 *                     type: string
 *                   selfieVerification:
 *                     type: string
 *                   proofOfAddress:
 *                     type: string
 *                   vehiclePhoto:
 *                     type: string
 *                   vehicleInsurance:
 *                     type: string
 *                   vehicleRegistration:
 *                     type: string
 *                   roadworthinessDoc:
 *                     type: string
 *               financialDetails:
 *                 type: object
 *                 properties:
 *                   bankName:
 *                     type: string
 *                   accountNumber:
 *                     type: string
 *                   accountName:
 *                     type: string
 *               safetyAcknowledgements:
 *                 type: object
 *                 properties:
 *                   helmetAndSafetyGear:
 *                     type: boolean
 *                   speedLimitsAndTrafficLaws:
 *                     type: boolean
 *                   foodHygieneAndInsulatedBag:
 *                     type: boolean
 *                   zeroToleranceSubstances:
 *                     type: boolean
 *               agreements:
 *                 type: object
 *                 properties:
 *                   courierAgreementAccepted:
 *                     type: boolean
 *                   accuracyDeclarationAccepted:
 *                     type: boolean
 *                   backgroundCheckConsentAccepted:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Progress saved or application successfully submitted for review
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Validation error or missing required fields for final submission
 *       401:
 *         description: Unauthorized
 */
router.post('/verification/submit', rider_verification_controller_1.default.submitRiderVerification);
/**
 * @openapi
 * /api/v1/riders/verification/skip:
 *   post:
 *     tags:
 *       - Rider Verification
 *     summary: Skip rider verification to explore the courier hub
 *     description: Defers verification and marks hasSkippedRiderOnboarding = true. The rider can explore dashboard, earnings, and settings, but cannot go online or accept delivery assignments until approved.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification deferred successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.post('/verification/skip', rider_verification_controller_1.default.skipOnboarding);
/**
 * @openapi
 * /api/v1/riders/admin/verifications:
 *   get:
 *     tags:
 *       - Rider Verification Admin
 *     summary: List rider onboarding applications for admin review
 *     description: Admin endpoint to list courier verification applications with search, status filters, and masked sensitive identification (NIN).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, pending, under_review, action_required, approved, rejected]
 *         description: Filter applications by verification status
 *       - in: query
 *         name: deliveryMethod
 *         schema:
 *           type: string
 *           enum: [all, bicycle, ebike, motorcycle, car]
 *         description: Filter applications by delivery method
 *       - in: query
 *         name: countryCode
 *         schema:
 *           type: string
 *         description: Filter applications by ISO country code (e.g. NG, GB)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, phone, email, or registration plate
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Applications retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden. Requires Admin privileges.
 */
router.get('/admin/verifications', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN), rider_verification_controller_1.default.adminListRiderVerifications);
/**
 * @openapi
 * /api/v1/riders/admin/verifications/{id}:
 *   get:
 *     tags:
 *       - Rider Verification Admin
 *     summary: Get single rider verification application details
 *     description: Admin endpoint to inspect full application, vehicle data, safety declarations, and uploaded documents.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the rider onboarding application
 *     responses:
 *       200:
 *         description: Rider application details retrieved
 *       404:
 *         description: Application not found
 *       403:
 *         description: Forbidden
 */
router.get('/admin/verifications/:id', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN), rider_verification_controller_1.default.adminGetRiderVerificationDetails);
/**
 * @openapi
 * /api/v1/riders/admin/verifications/{id}/approve:
 *   patch:
 *     tags:
 *       - Rider Verification Admin
 *     summary: Approve courier verification application
 *     description: Marks application and user as approved, activates rider account, and dispatches in-app notification allowing courier to go online and accept delivery jobs.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the rider onboarding application
 *     responses:
 *       200:
 *         description: Courier application approved and activated
 *       404:
 *         description: Application not found
 *       403:
 *         description: Forbidden
 */
router.patch('/admin/verifications/:id/approve', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN), rider_verification_controller_1.default.adminApproveRider);
/**
 * @openapi
 * /api/v1/riders/admin/verifications/{id}/reject:
 *   patch:
 *     tags:
 *       - Rider Verification Admin
 *     summary: Reject or request corrections on rider verification application
 *     description: Sets status to action_required, records reviewer notes and rejection reason, and notifies courier with required fixes.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the rider onboarding application
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rejectionReason]
 *             properties:
 *               rejectionReason:
 *                 type: string
 *                 example: Driver license expired. Please upload a valid document.
 *               notes:
 *                 type: string
 *                 example: License expired on 2024-01-01
 *     responses:
 *       200:
 *         description: Application status updated to action_required and courier notified
 *       400:
 *         description: Missing rejection reason
 *       404:
 *         description: Application not found
 *       403:
 *         description: Forbidden
 */
router.patch('/admin/verifications/:id/reject', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN), rider_verification_controller_1.default.adminRejectRider);
exports.default = router;
