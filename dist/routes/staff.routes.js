"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const staff_controller_1 = __importDefault(require("../controllers/staff.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
// All staff routes require Vendor authentication
router.use(auth_middleware_1.protect);
router.use((0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR));
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
    .get(staff_controller_1.default.getStaff)
    .post(staff_controller_1.default.inviteStaff);
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
    .patch(staff_controller_1.default.updateStaff)
    .delete(staff_controller_1.default.removeStaff);
exports.default = router;
