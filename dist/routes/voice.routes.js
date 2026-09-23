"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const voice_controller_1 = __importDefault(require("../controllers/voice.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/**
 * @openapi
 * /api/v1/voice/token:
 *   post:
 *     tags:
 *       - Voice
 *     summary: Generate Twilio Voice Access Token for in-app calling
 *     description: Issues an ephemeral JWT access token with a VoiceGrant permitting in-app VoIP audio calls between the authenticated user and courier.
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
 *                 enum: [customer, rider]
 *                 default: customer
 *                 description: User calling role in this session
 *               platform:
 *                 type: string
 *                 enum: [ios, android]
 *                 default: ios
 *                 description: Mobile platform for APNs vs FCM push credential assignment
 *     responses:
 *       200:
 *         description: Twilio Voice access token generated successfully
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
 *                       description: Twilio Voice JWT token
 *                     identity:
 *                       type: string
 *                       description: Current user identity (e.g. customer_64a...)
 *                     recipientIdentity:
 *                       type: string
 *                       description: Recipient identity (e.g. rider_64b...)
 *                     orderId:
 *                       type: string
 *                     rider:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         phoneNumber:
 *                           type: string
 *                         profilePicture:
 *                           type: string
 *                         vehicleType:
 *                           type: string
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *       500:
 *         description: Twilio service error
 */
router.post('/token', auth_middleware_1.protect, voice_controller_1.default.getToken);
/**
 * @openapi
 * /api/v1/voice/twiml:
 *   post:
 *     tags:
 *       - Voice
 *     summary: Twilio TwiML Webhook for dynamic call routing
 *     description: Webhook called by Twilio Voice SDK when an outgoing call is placed from the mobile app. Returns TwiML XML instructions to bridge to the recipient client.
 *     parameters:
 *       - in: query
 *         name: To
 *         schema:
 *           type: string
 *         description: Recipient client identity or phone number
 *     requestBody:
 *       required: false
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               To:
 *                 type: string
 *                 description: Recipient client identity or phone number
 *     responses:
 *       200:
 *         description: TwiML XML response
 *         content:
 *           text/xml:
 *             schema:
 *               type: string
 *               example: <Response><Dial callerId="+19707037753"><Client>rider_123</Client></Dial></Response>
 */
router.post('/twiml', voice_controller_1.default.handleTwiml);
router.get('/twiml', voice_controller_1.default.handleTwiml);
/**
 * @openapi
 * /api/v1/voice/bridge:
 *   post:
 *     tags:
 *       - Voice
 *     summary: Initiate Masked Cellular Call Bridge
 *     description: Bridges a real phone call between the customer and courier via Twilio virtual number, hiding both parties' actual phone numbers.
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
 *                 description: Active order ObjectId
 *     responses:
 *       200:
 *         description: Masked phone call initiated
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
 *                     callSid:
 *                       type: string
 *                     message:
 *                       type: string
 *                     maskedCallerId:
 *                       type: string
 *       400:
 *         description: Missing orderId or courier/customer phone number unavailable
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *       500:
 *         description: Twilio bridge call failed
 */
router.post('/bridge', auth_middleware_1.protect, voice_controller_1.default.initiateMaskedBridge);
exports.default = router;
