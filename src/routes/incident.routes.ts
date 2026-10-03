import { Router } from 'express';
import incidentController from '../controllers/incident.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

// Protect all incident routes
router.use(protect);

/**
 * @openapi
 * /api/v1/incidents:
 *   post:
 *     tags:
 *       - Incidents
 *     summary: Report a road incident or delivery delay
 *     description: Allows couriers to submit road hazards, breakdown, severe traffic, or safety issues. If linked to an active delivery order, automatically alerts the customer via push notification and real-time socket events.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - issueType
 *               - notes
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: Associated active order ID (optional)
 *                 example: "64b0f4a1234567890abcdef1"
 *               issueType:
 *                 type: string
 *                 description: Categorized road issue identifier
 *                 example: "road_blockage"
 *               issueTitle:
 *                 type: string
 *                 description: Human-readable issue title
 *                 example: "Road Blocked / Construction"
 *               notes:
 *                 type: string
 *                 description: Detailed narrative describing the incident
 *                 example: "Main highway blocked by police barricade; taking a 15-minute detour."
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *                 example: "medium"
 *     responses:
 *       201:
 *         description: Road incident recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Road incident reported successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized, missing token
 */
router.post(
  '/',
  restrictTo(UserRole.RIDER, UserRole.ADMIN),
  incidentController.createIncident
);

/**
 * @openapi
 * /api/v1/incidents:
 *   get:
 *     tags:
 *       - Incidents
 *     summary: Get all reported road incidents
 *     description: Retrieve paginated list of road incident reports filed by couriers, filterable by status and priority for administrative oversight.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, pending, reviewed, resolved]
 *         description: Filter incidents by resolution status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [all, low, medium, high, critical]
 *         description: Filter incidents by priority level
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Incidents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     incidents:
 *                       type: array
 *                       items:
 *                         type: object
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden, Admin only
 */
router.get(
  '/',
  restrictTo(UserRole.ADMIN),
  incidentController.getAllIncidents
);

/**
 * @openapi
 * /api/v1/incidents/{id}/status:
 *   patch:
 *     tags:
 *       - Incidents
 *     summary: Update incident resolution status
 *     description: Mark an incident report as reviewed or resolved, with administrative notes.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the incident report
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, reviewed, resolved]
 *                 example: "resolved"
 *               resolutionNotes:
 *                 type: string
 *                 example: "Contacted courier; detour cleared and delivered."
 *     responses:
 *       200:
 *         description: Incident status updated successfully
 *       400:
 *         description: Invalid status value
 *       404:
 *         description: Incident not found
 */
router.patch(
  '/:id/status',
  restrictTo(UserRole.ADMIN),
  incidentController.updateIncidentStatus
);

export default router;
