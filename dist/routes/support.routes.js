"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const support_controller_1 = __importDefault(require("../controllers/support.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.protect);
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
    .post((0, auth_middleware_1.restrictTo)(user_model_1.UserRole.CUSTOMER), support_controller_1.default.createTicket)
    .get((0, auth_middleware_1.restrictTo)(user_model_1.UserRole.CUSTOMER), support_controller_1.default.getMyTickets);
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
router.patch('/tickets/:id/resolve', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN), support_controller_1.default.resolveTicket);
exports.default = router;
