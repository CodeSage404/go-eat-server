import { Router } from 'express';
import orderController from '../controllers/order.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

router.use(protect);

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
router.post('/', restrictTo(UserRole.CUSTOMER), orderController.placeOrder);

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
router.get('/my-orders', orderController.getMyOrders);

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
router.get('/:id', orderController.getOrderById);

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
router.patch('/:id/status', orderController.updateStatus);

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
router.patch('/:id/accept', restrictTo(UserRole.RIDER), orderController.acceptDelivery);

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
router.post('/:id/reorder', restrictTo(UserRole.CUSTOMER), orderController.reorder);

export default router;
