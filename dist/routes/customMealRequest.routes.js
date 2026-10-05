"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const customMealRequest_controller_1 = __importDefault(require("../controllers/customMealRequest.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const upload_1 = require("../utils/upload");
const router = (0, express_1.Router)();
// Require authentication for all custom request operations
router.use(auth_middleware_1.protect);
/**
 * @openapi
 * /api/v1/custom-requests:
 *   post:
 *     summary: Create a custom meal request
 *     description: Allows customers to submit a bespoke meal request with custom ingredients or dishes to a Signature Chef.
 *     tags:
 *       - Custom Requests
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - requestText
 *             properties:
 *               restaurantId:
 *                 type: string
 *                 description: ObjectId of the Signature Chef restaurant
 *               requestText:
 *                 type: string
 *                 description: Detailed description of what meal customer wants
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional reference photo URLs
 *               specialNotes:
 *                 type: string
 *                 description: Optional dietary notes or instructions
 *     responses:
 *       201:
 *         description: Custom meal request created successfully
 *       400:
 *         description: Validation error or missing fields
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Restaurant not found
 */
router.post('/', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN), upload_1.upload.fields([{ name: 'photos', maxCount: 5 }]), customMealRequest_controller_1.default.createRequest);
/**
 * @openapi
 * /api/v1/custom-requests:
 *   get:
 *     summary: Get list of custom meal requests
 *     description: Retrieve custom meal requests. Returns vendor's requests for vendors, customer's requests for customers, or all for admins.
 *     tags:
 *       - Custom Requests
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, priced, accepted, rejected, completed, cancelled]
 *         description: Filter requests by status
 *       - in: query
 *         name: restaurantId
 *         schema:
 *           type: string
 *         description: Filter requests by restaurant ID (admins only)
 *     responses:
 *       200:
 *         description: List of custom meal requests retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', customMealRequest_controller_1.default.getRequests);
/**
 * @openapi
 * /api/v1/custom-requests/{id}:
 *   get:
 *     summary: Get a single custom meal request by ID
 *     description: Retrieve details of a specific custom meal request including quote if available.
 *     tags:
 *       - Custom Requests
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The custom meal request ObjectId
 *     responses:
 *       200:
 *         description: Custom meal request details retrieved successfully
 *       404:
 *         description: Request not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', customMealRequest_controller_1.default.getRequestById);
/**
 * @openapi
 * /api/v1/custom-requests/{id}/quote:
 *   post:
 *     summary: Send custom order quote to customer
 *     description: Allows the Signature Chef to set an itemized price, delivery fee, and custom message for the request.
 *     tags:
 *       - Custom Requests
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The custom meal request ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - price
 *             properties:
 *               itemName:
 *                 type: string
 *                 description: Title of custom dish
 *               price:
 *                 type: number
 *                 description: Quoted meal price
 *               deliveryFee:
 *                 type: number
 *                 description: Quoted delivery fee
 *               chefMessage:
 *                 type: string
 *                 description: Optional message from chef to customer
 *     responses:
 *       200:
 *         description: Quote sent successfully
 *       400:
 *         description: Invalid price or missing fields
 *       403:
 *         description: Forbidden - Not the outlet owner
 *       404:
 *         description: Request not found
 */
router.post('/:id/quote', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), customMealRequest_controller_1.default.sendQuote);
/**
 * @openapi
 * /api/v1/custom-requests/{id}/accept:
 *   post:
 *     summary: Customer accepts chef quote and creates order
 *     description: Allows the customer to accept the priced quote and convert it into an active order.
 *     tags:
 *       - Custom Requests
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The custom meal request ObjectId
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deliveryAddress:
 *                 type: object
 *               paymentMethod:
 *                 type: string
 *                 enum: [card, cash]
 *               deliveryNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Quote accepted and order created successfully
 *       400:
 *         description: Request not ready to accept
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Request not found
 */
router.post('/:id/accept', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN), customMealRequest_controller_1.default.acceptQuote);
/**
 * @openapi
 * /api/v1/custom-requests/{id}/status:
 *   patch:
 *     summary: Update custom meal request status
 *     description: Updates the status of a custom request (e.g. rejected, completed, cancelled).
 *     tags:
 *       - Custom Requests
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The custom meal request ObjectId
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
 *                 enum: [pending, priced, accepted, rejected, completed, cancelled]
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Request not found
 */
router.patch('/:id/status', customMealRequest_controller_1.default.updateStatus);
exports.default = router;
