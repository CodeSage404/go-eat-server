import { Router } from 'express';
import {
  applyForPartnership,
  getAllPartnerApplications,
  getPartnerApplicationById,
  updatePartnerApplicationStatus,
} from '../controllers/partnerApplication.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

/**
 * @openapi
 * /api/v1/partners/apply:
 *   post:
 *     tags:
 *       - Partners
 *     summary: Submit a partner onboarding application
 *     description: Allows restaurants, grocers, and food businesses to apply to partner with GoEat. Creates a pending application and sends an acknowledgement email.
 *     requestBody:
 *       required: true
 *       content:
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
 *     responses:
 *       201:
 *         description: Application submitted successfully
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
 *                   properties:
 *                     application:
 *                       type: object
 *       400:
 *         description: Validation error or missing required fields
 *       500:
 *         description: Internal server error
 */
router.post('/apply', applyForPartnership);

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

export default router;
