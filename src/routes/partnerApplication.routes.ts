import { Router } from 'express';
import {
  applyForPartnership,
  getAllPartnerApplications,
  getPartnerApplicationById,
  updatePartnerApplicationStatus,
  adminGrantAccess,
  adminApproveApplication,
  verifyClaimCode,
  claimPartnerProfile,
  optOutPartner,
} from '../controllers/partnerApplication.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';
import { upload } from '../utils/upload';

const router = Router();

/**
 * @openapi
 * /api/v1/partners/apply:
 *   post:
 *     tags:
 *       - Partners
 *     summary: Submit a partner onboarding application
 *     description: Allows restaurants, grocers, and food businesses to apply to partner with GoEat. Supports document uploads (NIN, Food Hygiene certificate, and optional CAC certificate). Creates a pending application and sends an acknowledgement email.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - businessName
 *               - businessAddress
 *               - email
 *               - phoneNumber
 *             properties:
 *               businessName:
 *                 type: string
 *                 example: The Artisan Burger
 *               businessAddress:
 *                 type: string
 *                 example: 14 Broad Street, Lagos
 *               businessType:
 *                 type: string
 *                 enum: [restaurant, grocery, convenience, bakery, cafe, other]
 *                 example: restaurant
 *               ownerName:
 *                 type: string
 *                 example: Alexander Davis
 *               firstName:
 *                 type: string
 *                 example: Alexander
 *               lastName:
 *                 type: string
 *                 example: Davis
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alexander@artisanburger.com
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348012345678"
 *               city:
 *                 type: string
 *                 example: Lagos
 *               nin:
 *                 type: string
 *                 format: binary
 *                 description: Mandatory National Identification Number document or image
 *               foodHygiene:
 *                 type: string
 *                 format: binary
 *                 description: Mandatory Food Hygiene Certificate document or image
 *               cac:
 *                 type: string
 *                 format: binary
 *                 description: Optional Corporate Affairs Commission (CAC) certificate for registered entities
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - businessName
 *               - businessAddress
 *               - email
 *               - phoneNumber
 *             properties:
 *               businessName:
 *                 type: string
 *                 example: The Artisan Burger
 *               businessAddress:
 *                 type: string
 *                 example: 14 Broad Street, Lagos
 *               businessType:
 *                 type: string
 *                 enum: [restaurant, grocery, convenience, bakery, cafe, other]
 *                 example: restaurant
 *               ownerName:
 *                 type: string
 *                 example: Alexander Davis
 *               firstName:
 *                 type: string
 *                 example: Alexander
 *               lastName:
 *                 type: string
 *                 example: Davis
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alexander@artisanburger.com
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348012345678"
 *               city:
 *                 type: string
 *                 example: Lagos
 *               ninUrl:
 *                 type: string
 *                 example: https://res.cloudinary.com/demo/image/upload/nin.jpg
 *               foodHygieneUrl:
 *                 type: string
 *                 example: https://res.cloudinary.com/demo/image/upload/food_hygiene.jpg
 *               cacUrl:
 *                 type: string
 *                 example: https://res.cloudinary.com/demo/image/upload/cac.jpg
 *               businessImageUrl:
 *                 type: string
 *                 description: Optional business profile or logo image URL
 *                 example: https://res.cloudinary.com/demo/image/upload/logo.jpg
 *               coverImageUrl:
 *                 type: string
 *                 description: Optional restaurant cover or storefront banner image URL
 *                 example: https://res.cloudinary.com/demo/image/upload/cover.jpg
 *     responses:
 *       201:
 *         description: Application submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *               status:
 *                 type: string
 *                 example: success
 *               message:
 *                 type: string
 *               data:
 *                 type: object
 *                 properties:
 *                   application:
 *                     type: object
 *       400:
 *         description: Validation error or missing required fields
 *         500:
 *           description: Internal server error
 */
router.post(
  '/apply',
  upload.fields([
    { name: 'nin', maxCount: 1 },
    { name: 'foodHygiene', maxCount: 1 },
    { name: 'cac', maxCount: 1 },
    { name: 'businessImage', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
  ]),
  applyForPartnership
);

/**
 * @openapi
 * /api/v1/partners/verify-claim:
 *   get:
 *     tags:
 *       - Partners
 *     summary: Verify single-use claim code for a partner application
 *     description: Validates that a partner claim code is valid, unexpired, and not yet claimed before presenting the password setup interface (UK GDPR & security compliance).
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: Registered partner email address
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Single-use 6-digit claim verification code
 *     responses:
 *       200:
 *         description: Code is valid and profile is eligible to be claimed
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
 *                     businessName:
 *                       type: string
 *                     ownerName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     isValid:
 *                       type: boolean
 *       400:
 *         description: Expired or already claimed verification code
 *       404:
 *         description: Code or email not found
 */
router.get('/verify-claim', verifyClaimCode);

/**
 * @openapi
 * /api/v1/partners/claim-profile:
 *   post:
 *     tags:
 *       - Partners
 *     summary: Claim provisional business profile and establish password
 *     description: Allows the business owner to verify their single-use code, establish their private password, and receive an active session token (UK compliance replacement for plaintext password emails).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: merchant@artisanburger.co.uk
 *               code:
 *                 type: string
 *                 example: "742915"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Profile successfully claimed and authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 token:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *       400:
 *         description: Invalid input, expired code, or password too short
 *       404:
 *         description: Profile not found
 */
router.post('/claim-profile', claimPartnerProfile);

/**
 * @openapi
 * /api/v1/partners/opt-out:
 *   post:
 *     tags:
 *       - Partners
 *     summary: Decline partner invitation and request profile removal
 *     description: Allows a restaurant owner to decline an invitation and request immediate unpublishing and removal of their business profile in accordance with UK GDPR Article 17 (Right to Erasure).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: owner@restaurant.co.uk
 *               token:
 *                 type: string
 *                 description: Optional security opt-out token from the email invitation
 *               reason:
 *                 type: string
 *                 example: Not interested in delivery platform listing
 *     responses:
 *       200:
 *         description: Profile removed and invitation declined successfully
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
 */
router.post('/opt-out', optOutPartner);

/**
 * @openapi
 * /api/v1/partners/applications:
 *   get:
 *     tags:
 *       - Partners
 *     summary: List all partner applications (Admin only)
 *     description: Retrieve a paginated list of restaurant and business onboarding applications with optional status and search filtering.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, pending, under_review, approved, rejected]
 *         description: Filter by application status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by business name, owner name, email, or phone
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
 *         description: List of partner applications
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 */
router.get(
  '/applications',
  protect,
  restrictTo(UserRole.ADMIN),
  getAllPartnerApplications
);

/**
 * @openapi
 * /api/v1/partners/applications/{id}:
 *   get:
 *     tags:
 *       - Partners
 *     summary: Get single partner application details (Admin only)
 *     description: Retrieve detailed information for a specific partner onboarding application.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Application ID
 *     responses:
 *       200:
 *         description: Partner application details
 *       404:
 *         description: Application not found
 */
router.get(
  '/applications/:id',
  protect,
  restrictTo(UserRole.ADMIN),
  getPartnerApplicationById
);

/**
 * @openapi
 * /api/v1/partners/applications/{id}:
 *   patch:
 *     tags:
 *       - Partners
 *     summary: Update partner application status or review notes (Admin only)
 *     description: Allows administrators to approve, reject, or annotate partner applications.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Application ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, under_review, approved, rejected]
 *               adminNotes:
 *                 type: string
 *               onboardedRestaurant:
 *                 type: string
 *                 description: Restaurant ObjectId if already onboarded
 *     responses:
 *       200:
 *         description: Application status updated successfully
 *       400:
 *         description: Invalid status value
 *       404:
 *         description: Application not found
 */
router.patch(
  '/applications/:id',
  protect,
  restrictTo(UserRole.ADMIN),
  updatePartnerApplicationStatus
);

/**
 * @openapi
 * /api/v1/partners/applications/{id}/grant-access:
 *   post:
 *     tags:
 *       - Partners
 *     summary: Grant vendor app access without waiting for document review (Admin only)
 *     description: Provisions a vendor user and restaurant profile in pending verification state, generates secure credentials, and emails them to the applicant immediately.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Application ID
 *     responses:
 *       200:
 *         description: Vendor access granted and credentials emailed
 *       404:
 *         description: Application not found
 */
router.post(
  '/applications/:id/grant-access',
  protect,
  restrictTo(UserRole.ADMIN),
  adminGrantAccess
);

/**
 * @openapi
 * /api/v1/partners/applications/{id}/approve:
 *   post:
 *     tags:
 *       - Partners
 *     summary: Approve partner application and activate restaurant (Admin only)
 *     description: Fully approves the partner application and activates the vendor's restaurant, allowing them to take live orders.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Application ID
 *     responses:
 *       200:
 *         description: Application approved and restaurant activated
 *       404:
 *         description: Application not found
 */
router.post(
  '/applications/:id/approve',
  protect,
  restrictTo(UserRole.ADMIN),
  adminApproveApplication
);

export default router;
