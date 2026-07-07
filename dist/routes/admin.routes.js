"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = __importDefault(require("../controllers/admin.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
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
router.post('/auth/login', admin_controller_1.default.adminLogin);
// Enforce auth & restrict all endpoints to platform Admins only
router.use(auth_middleware_1.protect);
router.use((0, auth_middleware_1.restrictTo)(user_model_1.UserRole.ADMIN));
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
router.post('/auth/reset-password', admin_controller_1.default.adminResetPassword);
router.post('/auth/refresh-token', admin_controller_1.default.refreshAdminToken);
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
router.get('/platform-stats', admin_controller_1.default.getPlatformStats);
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
router.get('/users', admin_controller_1.default.getAllUsers);
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
router.post('/users/:id/status', admin_controller_1.default.updateUserStatus);
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
router.get('/restaurants', admin_controller_1.default.getAllRestaurants);
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
router.get('/orders', admin_controller_1.default.getAllOrders);
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
router.post('/restaurants/:id/status', admin_controller_1.default.updateRestaurantStatus);
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
router.get('/restaurants/:id', admin_controller_1.default.getRestaurantById);
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
router.get('/restaurants/:id/orders', admin_controller_1.default.getRestaurantOrders);
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
router.post('/restaurants/manual-signup', admin_controller_1.default.manuallyCreateRestaurant);
router.get('/orders/:id', admin_controller_1.default.getOrderById);
router.get('/menu-items', admin_controller_1.default.getAllMenuItems);
router.get('/menu-items/:id', admin_controller_1.default.getMenuItemById);
router.post('/menu-items', admin_controller_1.default.createMenuItem);
router.patch('/menu-items/:id', admin_controller_1.default.updateMenuItem);
router.delete('/menu-items/:id', admin_controller_1.default.deleteMenuItem);
router.get('/bookings', admin_controller_1.default.getAllBookings);
router.get('/bookings/:id', admin_controller_1.default.getBookingById);
router.patch('/bookings/:id/status', admin_controller_1.default.updateBookingStatus);
router.get('/transactions', admin_controller_1.default.getAllTransactions);
/**
 * @openapi
 * /api/v1/admin/promos:
 *   get:
 *     tags:
 *       - Admin Promos
 *     summary: Get all promo codes & coupons
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of promo codes returned
 *   post:
 *     tags:
 *       - Admin Promos
 *     summary: Create a new promo/coupon code
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, discountPercentage, expiryDate]
 *             properties:
 *               code:
 *                 type: string
 *               discountPercentage:
 *                 type: number
 *               expiryDate:
 *                 type: string
 *               maxDiscountAmount:
 *                 type: number
 *               minOrderAmount:
 *                 type: number
 *     responses:
 *       201:
 *         description: Promo created
 */
router.get('/promos', admin_controller_1.default.getAllPromos);
router.post('/promos', admin_controller_1.default.createPromo);
/**
 * @openapi
 * /api/v1/admin/promos/{id}/status:
 *   patch:
 *     tags:
 *       - Admin Promos
 *     summary: Toggle promo/coupon status
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
 *             required: [isActive]
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch('/promos/:id/status', admin_controller_1.default.updatePromoStatus);
/**
 * @openapi
 * /api/v1/admin/promos/{id}:
 *   delete:
 *     tags:
 *       - Admin Promos
 *     summary: Delete a promo/coupon code
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
 *         description: Promo deleted
 */
router.delete('/promos/:id', admin_controller_1.default.deletePromo);
/**
 * @openapi
 * /api/v1/admin/notifications:
 *   get:
 *     tags:
 *       - Admin Notifications
 *     summary: Get notification broadcast log history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logs returned
 */
router.get('/notifications', admin_controller_1.default.getAllNotifications);
/**
 * @openapi
 * /api/v1/admin/notifications/broadcast:
 *   post:
 *     tags:
 *       - Admin Notifications
 *     summary: Send a multi-channel broadcast (Push, Email, SMS)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body, channels, recipientType]
 *             properties:
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               channels:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [push, email, sms]
 *               recipientType:
 *                 type: string
 *                 enum: [all, role, selected]
 *               targetRole:
 *                 type: string
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Notification broadcast successfully queued/sent
 */
router.post('/notifications/broadcast', admin_controller_1.default.broadcastNotification);
/**
 * @openapi
 * /api/v1/admin/users:
 *   post:
 *     tags:
 *       - Admin User Management
 *     summary: Create a new platform user account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               role:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
 */
router.post('/users', admin_controller_1.default.createUser);
/**
 * @openapi
 * /api/v1/admin/users/{id}:
 *   patch:
 *     tags:
 *       - Admin User Management
 *     summary: Update profile details or status of a user
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
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               role:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated
 *   delete:
 *     tags:
 *       - Admin User Management
 *     summary: Delete a user account permanently
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
 *         description: User deleted
 */
router.patch('/users/:id', admin_controller_1.default.updateUser);
router.delete('/users/:id', admin_controller_1.default.deleteUser);
/**
 * @openapi
 * /api/v1/admin/roles-permissions:
 *   get:
 *     tags:
 *       - Admin Roles
 *     summary: Get all roles & permissions matrix configs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Matrix list returned
 */
router.get('/roles-permissions', admin_controller_1.default.getRolesPermissions);
/**
 * @openapi
 * /api/v1/admin/roles-permissions/{id}:
 *   patch:
 *     tags:
 *       - Admin Roles
 *     summary: Update access permissions list for a role
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
 *             required: [permissions]
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Permissions updated
 */
router.patch('/roles-permissions/:id', admin_controller_1.default.updateRolePermissions);
/**
 * @openapi
 * /api/v1/admin/audit-logs:
 *   get:
 *     tags:
 *       - Admin Audits
 *     summary: Retrieve admin audit log events history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit logs list returned
 */
router.get('/audit-logs', admin_controller_1.default.getAuditLogs);
/**
 * @openapi
 * /api/v1/admin/system-logs:
 *   get:
 *     tags:
 *       - Admin Audits
 *     summary: Retrieve system diagnostic crash and event logs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System logs returned
 */
router.get('/system-logs', admin_controller_1.default.getSystemLogs);
exports.default = router;
