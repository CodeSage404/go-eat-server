import { Router } from 'express';
import staffController from '../controllers/staff.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

// All staff routes require Vendor authentication
router.use(protect);
router.use(restrictTo(UserRole.VENDOR));

/**
 * @openapi
 * /api/v1/staff:
 *   get:
 *     tags:
 *       - Staff
 *     summary: Get all staff members for the logged-in vendor
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of staff members
 *
 *   post:
 *     tags:
 *       - Staff
 *     summary: Invite/Create a new staff member
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, customRole]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               customRole:
 *                 type: string
 *                 example: Cashier
 *     responses:
 *       201:
 *         description: Staff member created
 */
router.route('/')
  .get(staffController.getStaff)
  .post(staffController.inviteStaff);

/**
 * @openapi
 * /api/v1/staff/{id}:
 *   patch:
 *     tags:
 *       - Staff
 *     summary: Update a staff member's details or status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               customRole:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended]
 *     responses:
 *       200:
 *         description: Staff member updated
 *
 *   delete:
 *     tags:
 *       - Staff
 *     summary: Remove a staff member
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Staff member removed
 */
router.route('/:id')
  .patch(staffController.updateStaff)
  .delete(staffController.removeStaff);

export default router;
