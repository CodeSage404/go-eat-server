"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zego_controller_1 = __importDefault(require("../controllers/zego.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/**
 * @openapi
 * /api/v1/zego/token:
 *   post:
 *     tags:
 *       - Zego
 *     summary: Generate ZEGOCLOUD RTC Access Token for in-app calling
 *     description: Issues an ephemeral token04 RTC access token with AppID and room metadata for in-app VoIP audio calls between courier and customer.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: The MongoDB ObjectId of the active order
 *               role:
 *                 type: string
 *                 enum: [customer, rider, vendor]
 *                 default: customer
 *                 description: User calling role in this session
 *               target:
 *                 type: string
 *                 enum: [customer, rider, restaurant]
 *                 default: customer
 *                 description: Target party recipient for the voice call session
 *     responses:
 *       200:
 *         description: ZEGOCLOUD RTC token and room metadata generated successfully
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
 *                     token:
 *                       type: string
 *                       description: ZEGOCLOUD token04 string
 *                     appId:
 *                       type: number
 *                       example: 1031074673
 *                     appSign:
 *                       type: string
 *                     roomId:
 *                       type: string
 *                       example: goeat_order_6a86688019cd31f73f26f615
 *                     userId:
 *                       type: string
 *                       example: rider_6abe8df9f317d72932842e4d
 *                     userName:
 *                       type: string
 *                       example: Delivery Courier
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
router.post('/token', auth_middleware_1.protect, zego_controller_1.default.getToken);
/**
 * @openapi
 * /api/v1/zego/notify:
 *   post:
 *     tags:
 *       - Zego
 *     summary: Dispatch incoming call notification to recipient
 *     description: Notifies the call recipient device via Socket.IO and FCM push notification when an outgoing call is placed.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: The MongoDB ObjectId of the active order
 *               role:
 *                 type: string
 *                 enum: [customer, rider, vendor]
 *                 default: customer
 *                 description: User calling role
 *               target:
 *                 type: string
 *                 enum: [customer, rider, restaurant]
 *                 default: customer
 *     responses:
 *       200:
 *         description: Notification dispatched successfully
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
 *                   example: Recipient notified
 *       400:
 *         description: Missing orderId
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/notify', auth_middleware_1.protect, zego_controller_1.default.notifyRecipient);
/**
 * @openapi
 * /api/v1/zego/end-call:
 *   post:
 *     tags:
 *       - Zego
 *     summary: Notify call participant that call has ended
 *     description: Emits a real-time Socket.IO call_ended event to the other party so their device immediately dismisses active call screens and cancels ringing.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: The MongoDB ObjectId of the active order
 *               role:
 *                 type: string
 *                 enum: [customer, rider, vendor]
 *                 default: customer
 *                 description: Calling role who ended the call
 *               target:
 *                 type: string
 *                 enum: [customer, rider, restaurant]
 *                 default: customer
 *                 description: Other party who should be notified of the call termination
 *     responses:
 *       200:
 *         description: Call end notification dispatched successfully
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
 *                   example: Call ended notification sent
 *       400:
 *         description: Missing orderId
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/end-call', auth_middleware_1.protect, zego_controller_1.default.endCall);
/**
 * @openapi
 * /api/v1/zego/missed-call:
 *   post:
 *     tags:
 *       - Zego
 *     summary: Notify call recipient that a call was missed
 *     description: Emits a real-time Socket.IO missed_call event and sends a high-priority FCM push notification to the recipient alerting them of a missed voice call.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: The MongoDB ObjectId of the active order
 *               role:
 *                 type: string
 *                 enum: [customer, rider, vendor]
 *                 default: customer
 *                 description: Calling role who dialed the call
 *               target:
 *                 type: string
 *                 enum: [customer, rider, restaurant]
 *                 default: customer
 *                 description: Target party who missed the voice call
 *     responses:
 *       200:
 *         description: Missed call notification dispatched successfully
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
 *                   example: Missed call notification sent
 *       400:
 *         description: Missing orderId
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/missed-call', auth_middleware_1.protect, zego_controller_1.default.missedCall);
exports.default = router;
