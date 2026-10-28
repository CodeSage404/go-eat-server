import { Router } from 'express';
import supportController from '../controllers/support.controller';
import { protect, restrictTo, optionalAuth } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

/**
 * @openapi
 * /api/v1/support/contact:
 *   post:
 *     tags:
 *       - Support
 *     summary: Submit a public contact or support inquiry form
 *     description: Allows customers, couriers, partner stores, or web visitors to submit a message to customer support. Sends immediate email notifications to the support team and confirmation to the sender.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, message]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *               phone:
 *                 type: string
 *                 example: "+447123456789"
 *               role:
 *                 type: string
 *                 enum: [users, couriers, partners]
 *                 example: users
 *               category:
 *                 type: string
 *                 example: Orders & Tracking
 *               orderOrRefId:
 *                 type: string
 *                 example: ORD_64f1a2b3
 *               subject:
 *                 type: string
 *                 example: Question about delivery address
 *               message:
 *                 type: string
 *                 example: I need to update my delivery gate instructions for my active order.
 *     responses:
 *       200:
 *         description: Support inquiry submitted successfully.
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
 *                     reference:
 *                       type: string
 *                       example: SUP-123456
 *                     message:
 *                       type: string
 *                       example: Your message has been received! Our support team will get back to you shortly.
 *       400:
 *         description: Missing required fields.
 */
router.post('/contact', optionalAuth, supportController.submitContactForm);

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
