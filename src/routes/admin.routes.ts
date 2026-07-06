import { Router } from 'express';
import adminController from '../controllers/admin.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

// Public Admin Auth Routes
/**
 * @openapi
 * /api/v1/admin/auth/login:
 *   post:
 *     tags:
 *       - Admin Auth
 *     summary: Authenticate admin user
 *     description: Verify admin credentials from env and return a signed JWT.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@goeat.com
 *               password:
 *                 type: string
 *                 example: AdminPass123!
 *     responses:
 *       200:
 *         description: Login successful. Token returned.
 *       401:
 *         description: Invalid email or password.
 */
router.post('/auth/login', adminController.adminLogin);


// Enforce auth & restrict all endpoints to platform Admins only
router.use(protect);
router.use(restrictTo(UserRole.ADMIN));

// Protected Admin Auth Routes
/**
 * @openapi
 * /api/v1/admin/auth/reset-password:
 *   post:
 *     tags:
 *       - Admin Auth
 *     summary: Reset admin password
 *     description: Update the master password in memory, local env file, and db.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: AdminPass123!
 *               newPassword:
 *                 type: string
 *                 example: NewAdminPass123!
 *     responses:
 *       200:
 *         description: Password successfully updated.
 *       400:
 *         description: Password validation error.
 *       401:
 *         description: Incorrect current password.
 */
router.post('/auth/reset-password', adminController.adminResetPassword);
router.post('/auth/refresh-token', adminController.refreshAdminToken);

/**
 * @openapi
 * /api/v1/admin/platform-stats:
 *   get:
 *     tags:
 *       - Admin Dashboard
 *     summary: Retrieve platform wide operations & financial performance metrics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Operation statistics returned
 */
router.get('/platform-stats', adminController.getPlatformStats);

/**
 * @openapi
 * /api/v1/admin/users:
 *   get:
 *     tags:
 *       - Admin Dashboard
 *     summary: List all registered users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users returned
 */
router.get('/users', adminController.getAllUsers);

/**
 * @openapi
 * /api/v1/admin/users/{id}/status:
 *   patch:
 *     tags:
 *       - Admin Dashboard
 *     summary: Suspend or reactivate user accounts
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
 *                 enum: [active, suspended]
 *     responses:
 *       200:
 *         description: Status updated
 */
router.post('/users/:id/status', adminController.updateUserStatus);

/**
 * @openapi
 * /api/v1/admin/restaurants:
 *   get:
 *     tags:
 *       - Admin Dashboard
 *     summary: Retrieve list of all restaurants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of restaurants returned
 */
router.get('/restaurants', adminController.getAllRestaurants);

/**
 * @openapi
 * /api/v1/admin/orders:
 *   get:
 *     tags:
 *       - Admin Dashboard
 *     summary: Retrieve list of all orders across the platform
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of orders returned
 */
router.get('/orders', adminController.getAllOrders);

/**
 * @openapi
 * /api/v1/admin/restaurants/{id}/status:
 *   patch:
 *     tags:
 *       - Admin Dashboard
 *     summary: Change status of a restaurant (Approve/Suspend)
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
 *                 enum: [active, pending, suspended]
 *     responses:
 *       200:
 *         description: Restaurant status updated successfully
 */
router.post('/restaurants/:id/status', adminController.updateRestaurantStatus);

// Add these to your admin routes list
// router.get('/restaurants/:id', adminController.getRestaurantById);
// router.get('/restaurants/:id/orders', adminController.getRestaurantOrders);

/**
 * @openapi
 * /api/v1/admin/restaurants/{id}:
 * get:
 * tags:
 * - Admin Dashboard
 * summary: Get profile details of a single restaurant by ID
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: The unique MongoDB ID of the restaurant
 * responses:
 * 200:
 * description: Restaurant details retrieved successfully
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status:
 * type: string
 * example: success
 * data:
 * type: object
 * properties:
 * restaurant:
 * type: object
 * 404:
 * description: Restaurant not found
 */
router.get('/restaurants/:id', adminController.getRestaurantById);

/**
 * @openapi
 * /api/v1/admin/restaurants/{id}/orders:
 * get:
 * tags:
 * - Admin Dashboard
 * summary: Get all historical and pending orders for a specific restaurant
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: The unique MongoDB ID of the restaurant
 * responses:
 * 200:
 * description: Restaurant order history retrieved successfully
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status:
 * type: string
 * example: success
 * results:
 * type: integer
 * example: 12
 * data:
 * type: object
 * properties:
 * orders:
 * type: array
 * items:
 * type: object
 * 404:
 * description: Restaurant not found
 */
router.get('/restaurants/:id/orders', adminController.getRestaurantOrders);

/**
 * @openapi
 * /api/v1/admin/restaurants/manual-signup:
 *   post:
 *     tags:
 *       - Admin Dashboard
 *     summary: Manually create a vendor user and their restaurant profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ownerEmail, ownerPassword, restaurantName, address]
 *             properties:
 *               ownerName:
 *                 type: string
 *               ownerEmail:
 *                 type: string
 *               ownerPhone:
 *                 type: string
 *               ownerPassword:
 *                 type: string
 *               restaurantName:
 *                 type: string
 *               description:
 *                 type: string
 *               address:
 *                 type: object
 *               location:
 *                 type: object
 *               cuisine:
 *                 type: array
 *                 items:
 *                   type: string
 *               openingHours:
 *                 type: object
 *     responses:
 *       201:
 *         description: Vendor and restaurant successfully created
 */
router.post('/restaurants/manual-signup', adminController.manuallyCreateRestaurant);

router.get('/orders/:id', adminController.getOrderById);
router.get('/menu-items', adminController.getAllMenuItems);
router.get('/menu-items/:id', adminController.getMenuItemById);
router.post('/menu-items', adminController.createMenuItem);
router.patch('/menu-items/:id', adminController.updateMenuItem);
router.delete('/menu-items/:id', adminController.deleteMenuItem);

router.get('/bookings', adminController.getAllBookings);
router.get('/bookings/:id', adminController.getBookingById);
router.patch('/bookings/:id/status', adminController.updateBookingStatus);

router.get('/transactions', adminController.getAllTransactions);

router.get('/audit-logs', adminController.getAuditLogs);
router.get('/system-logs', adminController.getSystemLogs);

export default router;
