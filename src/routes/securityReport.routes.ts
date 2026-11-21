import { Router } from 'express';
import { SecurityReportController } from '../controllers/securityReport.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

/**
 * @openapi
 * /api/v1/security/reports:
 *   post:
 *     summary: Submit a security vulnerability report
 *     description: Public endpoint allowing security researchers or users to responsibly report vulnerabilities
 *     tags:
 *       - Security
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - platform
 *               - category
 *               - title
 *               - description
 *             properties:
 *               reporterName:
 *                 type: string
 *               reporterEmail:
 *                 type: string
 *               reporterType:
 *                 type: string
 *                 enum: [customer, partner, rider, researcher, other]
 *               platform:
 *                 type: string
 *                 enum: [website, ios, android, partner_dashboard, rider_app, api_backend, other]
 *               category:
 *                 type: string
 *                 enum: [authentication, access_control, data_exposure, payments_wallet, xss, api, other, unsure]
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               reproductionSteps:
 *                 type: string
 *               affectedUrl:
 *                 type: string
 *               potentialImpact:
 *                 type: string
 *               reporterSeverity:
 *                 type: string
 *                 enum: [critical, high, medium, low, unsure]
 *     responses:
 *       201:
 *         description: Report securely submitted with reference ticket ID
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Server error
 */
router.post('/reports', SecurityReportController.submitReport);

/**
 * @openapi
 * /api/v1/security/admin/reports:
 *   get:
 *     summary: List vulnerability reports
 *     description: Restricted admin endpoint to review submitted vulnerability reports
 *     tags:
 *       - Security
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Vulnerability reports retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/admin/reports', protect, restrictTo(UserRole.ADMIN), SecurityReportController.listReports);

/**
 * @openapi
 * /api/v1/security/admin/reports/{id}:
 *   get:
 *     summary: Get vulnerability report details
 *     description: Returns full description, attachments, internal notes, and audit timeline
 *     tags:
 *       - Security
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Report details retrieved
 *       404:
 *         description: Report not found
 */
router.get('/admin/reports/:id', protect, restrictTo(UserRole.ADMIN), SecurityReportController.getReportDetails);

/**
 * @openapi
 * /api/v1/security/admin/reports/{id}:
 *   patch:
 *     summary: Update report status or assigned severity
 *     description: Updates triage state, owner, or severity with automatic audit event logging
 *     tags:
 *       - Security
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *               assignedSeverity:
 *                 type: string
 *               ownerName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report updated successfully
 */
router.patch('/admin/reports/:id', protect, restrictTo(UserRole.ADMIN), SecurityReportController.updateReport);

/**
 * @openapi
 * /api/v1/security/admin/reports/{id}/notes:
 *   post:
 *     summary: Add internal note to report
 *     description: Adds staff-only investigation note to the vulnerability report
 *     tags:
 *       - Security
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - note
 *             properties:
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Internal note added
 */
router.post('/admin/reports/:id/notes', protect, restrictTo(UserRole.ADMIN), SecurityReportController.addInternalNote);

export default router;
