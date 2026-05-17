import { Router } from 'express';
import supportController from '../controllers/support.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

router.use(protect);

/**
 * @openapi
 * /api/v1/support/tickets:
 *   post:
 *     tags:
 *       - Support
 *     summary: Open a new support ticket
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [category, subject, description]
 *             properties:
 *               orderId:
 *                 type: string
 *               category:
 *                 type: string
 *               subject:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Ticket created
 *   get:
 *     tags:
 *       - Support
 *     summary: Get my support tickets
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tickets
 */
router.route('/tickets')
  .post(restrictTo(UserRole.CUSTOMER), supportController.createTicket)
  .get(restrictTo(UserRole.CUSTOMER), supportController.getMyTickets);

/**
 * @openapi
 * /api/v1/support/tickets/{id}/resolve:
 *   patch:
 *     tags:
 *       - Support
 *     summary: Resolve or reply to a ticket (Admin only)
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
 *             properties:
 *               adminResponse:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ticket updated
 */
router.patch('/tickets/:id/resolve', restrictTo(UserRole.ADMIN), supportController.resolveTicket);

export default router;
