"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const order_controller_1 = __importDefault(require("../controllers/order.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
const quoteFeeLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // max 30 quotes per minute per IP
    message: {
        status: 'fail',
        message: 'Too many delivery fee calculations requested from this IP, please try again in a moment.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// Public Order Fee & Quoting Routes
/**
 * @openapi
 * /api/v1/orders/fees:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Get public platform fee configuration
 *     description: Retrieve base delivery fee, per-km delivery rate, service fee, and small order thresholds set by admin.
 *     responses:
 *       200:
 *         description: Platform fee parameters returned successfully.
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
 *                     deliveryBaseFee:
 *                       type: number
 *                       example: 500
 *                     deliveryFeePerKm:
 *                       type: number
 *                       example: 100
 *                     deliveryFeeCalculationMode:
 *                       type: string
 *                       enum: [dynamic_distance, fixed]
 *                       example: dynamic_distance
 *                     fixedDeliveryFee:
 *                       type: number
 *                       example: 500
 *                     serviceFee:
 *                       type: number
 *                       example: 170
 *                     smallOrderFee:
 *                       type: number
 *                       example: 150
 *                     smallOrderFeeThreshold:
 *                       type: number
 *                       example: 1000
 *                     batchPickupThresholdKm:
 *                       type: number
 *                       example: 3.0
 *                     multiOutletExtraStopFee:
 *                       type: number
 *                       example: 300
 *                     maxDeliveryDistance:
 *                       type: number
 *                       example: 15
 *                     firstBiteEnabled:
 *                       type: boolean
 *                       example: true
 *                     firstBiteCampaignTitle:
 *                       type: string
 *                       example: Your First Bite is on Us
 *                     firstBiteDescription:
 *                       type: string
 *                       example: Enjoy your first meal on us as a welcome gift from Go-Eat!
 *                     firstBiteIsTotallyFree:
 *                       type: boolean
 *                       example: true
 *                     firstBiteMaxFreeAmount:
 *                       type: number
 *                       example: 3000
 */
router.get('/fees', order_controller_1.default.getPublicFees);
/**
 * @openapi
 * /api/v1/orders/quote-fee:
 *   post:
 *     tags:
 *       - Orders
 *     summary: Quote checkout fees and determine multi-outlet routing mode
 *     description: Calculate real-time delivery fee, service fee, and evaluate single vs. batched vs. split courier routing based on outlet locations and customer delivery coordinates.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [outlets]
 *             properties:
 *               outlets:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [restaurantId, subtotal]
 *                   properties:
 *                     restaurantId:
 *                       type: string
 *                       example: 64f1a2b3c4d5e6f7a8b9c0d1
 *                     subtotal:
 *                       type: number
 *                       example: 3500
 *                     itemCount:
 *                       type: number
 *                       example: 2
 *               deliveryCoordinates:
 *                 type: array
 *                 items:
 *                   type: number
 *                 example: [3.3792, 6.5244]
 *               deliveryAddressText:
 *                 type: string
 *                 example: 12 Marina Street, Lagos Island
 *               isPickup:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Fee quote and routing mode returned successfully.
 *       400:
 *         description: Invalid coordinates or address outside delivery radius.
 */
router.post('/quote-fee', quoteFeeLimiter, auth_middleware_1.optionalAuth, order_controller_1.default.quoteFees);
router.use(auth_middleware_1.protect);
/**
 * @openapi
 * /api/v1/orders/reset-first-bite:
 *   post:
 *     tags:
 *       - Orders
 *     summary: Reset First Bite promotion eligibility for testing
 *     description: Resets the authenticated user's hasUsedFirstBiteFreeOrder flag back to false so the user can test the promotion again.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: First Bite status reset successfully.
 *       401:
 *         description: Unauthorized.
 */
router.post('/reset-first-bite', order_controller_1.default.resetFirstBite);
// Customer routes
/**
 * @openapi
 * /api/v1/orders:
 *   post:
 *     tags:
 *       - Orders
 *     summary: Place a new order
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [restaurant, items, totalAmount, deliveryAddress, paymentMethod]
 *             properties:
 *               restaurant:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *               totalAmount:
 *                 type: number
 *               deliveryAddress:
 *                 type: object
 *               paymentMethod:
 *                 type: string
 *     responses:
 *       201:
 *         description: Order placed
 */
router.post('/', order_controller_1.default.placeOrder);
/**
 * @openapi
 * /api/v1/orders/checkout-multi:
 *   post:
 *     tags:
 *       - Orders
 *     summary: Place multi-outlet checkout orders (Batched Pickup or Split Delivery)
 *     description: Create multiple sub-orders across different restaurants within a single checkout, automatically routed as a single-rider batched pickup or parallel split deliveries based on distance.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subOrders, deliveryAddress]
 *             properties:
 *               subOrders:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [restaurant, items, totalAmount]
 *                   properties:
 *                     restaurant:
 *                       type: string
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                     totalAmount:
 *                       type: number
 *               deliveryAddress:
 *                 type: object
 *                 required: [coordinates, street]
 *                 properties:
 *                   street:
 *                     type: string
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *               paymentMethod:
 *                 type: string
 *                 enum: [card, cash]
 *     responses:
 *       201:
 *         description: Multi-outlet order successfully placed and routed.
 *       400:
 *         description: Validation error or outlet outside delivery radius.
 */
router.post('/checkout-multi', order_controller_1.default.placeMultiOutletOrder);
/**
 * @openapi
 * /api/v1/orders/available-jobs:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Get available delivery jobs ready for courier pickup
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available delivery jobs
 */
router.get('/available-jobs', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER, user_model_1.UserRole.ADMIN), order_controller_1.default.getAvailableJobs);
/**
 * @openapi
 * /api/v1/orders/my-orders:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Get logged-in user's orders (Customer, Vendor, or Rider)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of orders
 */
router.get('/my-orders', order_controller_1.default.getMyOrders);
/**
 * @openapi
 * /api/v1/orders/{id}:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Get order details by ID
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
 *         description: Order details
 */
router.get('/:id', order_controller_1.default.getOrderById);
// Shared/Specific routes for status updates
/**
 * @openapi
 * /api/v1/orders/{id}/status:
 *   patch:
 *     tags:
 *       - Orders
 *     summary: Update order status (Vendor/Rider only)
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, accepted, preparing, ready, out_for_delivery, delivered, cancelled]
 *               cancelReason:
 *                 type: string
 *                 description: Reason for cancellation if status is cancelled.
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch('/:id/status', order_controller_1.default.updateStatus);
/**
 * @openapi
 * /api/v1/orders/{id}/cancellation-preview:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Get pre-confirmation cancellation transparency preview
 *     description: Returns the transparent refund calculation (full, partial, or ineligible) and breakdown for an active order before customer confirms cancellation.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The unique MongoDB ID of the order
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cancellation preview details returned successfully.
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
 *                     orderId:
 *                       type: string
 *                     orderStatus:
 *                       type: string
 *                     eligible:
 *                       type: boolean
 *                     refundAmount:
 *                       type: number
 *                     refundType:
 *                       type: string
 *                       enum: [FULL_REFUND, PARTIAL_REFUND, NO_REFUND]
 *                     message:
 *                       type: string
 *                     canContactSupport:
 *                       type: boolean
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden, user does not own this order.
 *       404:
 *         description: Order not found.
 */
router.get('/:id/cancellation-preview', order_controller_1.default.getCancellationPreview);
/**
 * @openapi
 * /api/v1/orders/{id}/report-issue:
 *   post:
 *     tags:
 *       - Orders
 *     summary: Report an issue on a delivered order to claim a partial refund
 *     description: Customers can report order issues (missing items, wrong items, damaged food, food quality) within 24 hours of delivery. Photo evidence is mandatory for physical/food quality issues, and optional/exempt for missing items. Eligible refund is processed directly to the customer's original payment method via Stripe or Paystack.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The unique MongoDB ID of the delivered order
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [missing_item, wrong_item, damaged_item, food_quality, other]
 *                 description: Category of the order issue
 *               itemIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of foodItem IDs or order item IDs affected
 *               notes:
 *                 type: string
 *                 description: Additional notes or description of the issue
 *               customReason:
 *                 type: string
 *                 description: Custom reason if other is selected
 *               photoUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of photo evidence URLs (exempt for missing_item)
 *     responses:
 *       200:
 *         description: Issue report submitted successfully and refund processed if eligible.
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
 *                     success:
 *                       type: boolean
 *                     message:
 *                       type: string
 *                     refundAmount:
 *                       type: number
 *                     issue:
 *                       type: object
 *       400:
 *         description: Validation error, missing required photo, or order is past 24h delivery window.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden, user does not own this order.
 *       404:
 *         description: Order not found.
 */
router.post('/:id/report-issue', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN), order_controller_1.default.reportOrderIssue);
// Rider specific
/**
 * @openapi
 * /api/v1/orders/{id}/accept:
 *   patch:
 *     tags:
 *       - Orders
 *     summary: Accept a delivery job (Rider only)
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
 *         description: Delivery job accepted
 */
router.patch('/:id/accept', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER), order_controller_1.default.acceptDelivery);
/**
 * @openapi
 * /api/v1/orders/{id}/decline:
 *   patch:
 *     tags:
 *       - Orders
 *     summary: Decline an incoming delivery job offer (Rider only)
 *     description: Log courier decline for a job offer, update declinedRiders history, and automatically re-dispatch the job offer to the next closest available online courier.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The unique MongoDB ID of the order being declined
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job offer declined and re-routed successfully
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
 *                   example: Job declined successfully
 *       401:
 *         description: Unauthorized, missing or invalid token
 *       404:
 *         description: Order not found
 */
router.patch('/:id/decline', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER), order_controller_1.default.declineDelivery);
/**
 * @openapi
 * /api/v1/orders/{id}/reorder:
 *   post:
 *     tags:
 *       - Orders
 *     summary: Reorder a previous meal
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: New order created from history.
 */
router.post('/:id/reorder', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.CUSTOMER), order_controller_1.default.reorder);
/**
 * @openapi
 * /api/v1/orders/{id}/verify-delivery:
 *   post:
 *     tags:
 *       - Orders
 *     summary: Verify customer delivery PIN and complete delivery hand-off
 *     description: Validates the 4-digit recipient PIN provided by the customer to the courier or outlet upon delivery. Once verified, sets order status to delivered, logs verification timestamp, triggers payout settlements, and sends delivery confirmation notifications.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The unique MongoDB ID of the order
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pin
 *             properties:
 *               pin:
 *                 type: string
 *                 description: The 4-digit numeric delivery verification PIN provided by the recipient
 *                 example: "5821"
 *     responses:
 *       200:
 *         description: Delivery PIN verified successfully, order marked as delivered
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
 *                   example: "Delivery verified successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     order:
 *                       type: object
 *       400:
 *         description: Invalid or incorrect delivery PIN, or order is in a non-deliverable state
 *       401:
 *         description: Unauthorized, missing or invalid authentication token
 *       403:
 *         description: Forbidden, user is not assigned rider, outlet owner, or authorized administrator
 *       404:
 *         description: Order not found
 */
router.post('/:id/verify-delivery', rateLimiter_1.pinVerificationLimiter, (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER, user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), order_controller_1.default.verifyDeliveryPin);
/**
 * @openapi
 * /api/v1/orders/{id}/traffic-status:
 *   post:
 *     tags:
 *       - Orders
 *     summary: Update traffic delay status for an active delivery
 *     description: Toggles courier traffic delay on an active order. Alerts the customer via push notification and real-time socket events, updates the estimated delivery arrival time (ETA), and logs traffic timestamps.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The unique MongoDB ID of the order
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isInTraffic
 *             properties:
 *               isInTraffic:
 *                 type: boolean
 *                 description: Whether the courier is currently caught in traffic delay
 *                 example: true
 *               additionalMinutes:
 *                 type: number
 *                 description: Estimated delay to add to ETA in minutes (default 10)
 *                 example: 10
 *     responses:
 *       200:
 *         description: Traffic status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *               status:
 *                 type: string
 *                 example: success
 *               data:
 *                 type: object
 *                 properties:
 *                   orderId:
 *                     type: string
 *                   isInTraffic:
 *                     type: boolean
 *                   trafficDelayMinutes:
 *                     type: number
 *                   estimatedDeliveryTime:
 *                     type: string
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized, missing or invalid token
 *       403:
 *         description: Forbidden, user is not assigned courier for this order
 *       404:
 *         description: Order not found
 */
router.post('/:id/traffic-status', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.RIDER, user_model_1.UserRole.ADMIN), order_controller_1.default.updateTrafficStatus);
exports.default = router;
