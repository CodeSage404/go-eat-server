import { Router } from 'express';
import adminController from '../controllers/admin.controller';
import { protect, restrictTo, checkPermission } from '../middleware/auth.middleware';
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

/**
 * @openapi
 * /api/v1/admin/auth/refresh-token:
 *   post:
 *     tags:
 *       - Admin Auth
 *     summary: Refresh admin session token
 *     description: Issue a fresh JWT token for the admin session.
 *     responses:
 *       200:
 *         description: Token successfully refreshed.
 */
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
router.get('/users', checkPermission('users.read'), adminController.getAllUsers);

/**
 * @openapi
 * /api/v1/admin/users/{id}:
 *   get:
 *     tags:
 *       - Admin Dashboard
 *     summary: Retrieve single user profile by ID
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
 *         description: User profile details returned
 */
router.get('/users/:id', checkPermission('users.read'), adminController.getUserById);

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
router.post('/users/:id/status', checkPermission('users.suspend'), adminController.updateUserStatus);

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
router.get('/restaurants', checkPermission('restaurants.crud', 'restaurants.approve'), adminController.getAllRestaurants);

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
router.get('/orders', checkPermission('orders.read', 'orders.dispatch', 'orders.accept'), adminController.getAllOrders);

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
router.post('/restaurants/:id/status', checkPermission('restaurants.approve', 'restaurants.suspend'), adminController.updateRestaurantStatus);

/**
 * @openapi
 * /api/v1/admin/restaurants/{id}/top-spot:
 *   put:
 *     tags:
 *       - Admin Dashboard
 *     summary: Update Top Spot status for a restaurant
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
 *             required: [isTopSpot]
 *             properties:
 *               isTopSpot:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Top Spot status updated successfully
 */
router.put('/restaurants/:id/top-spot', checkPermission('restaurants.crud', 'restaurants.approve'), adminController.updateTopSpot);

// Add these to your admin routes list
// router.get('/restaurants/:id', adminController.getRestaurantById);
// router.get('/restaurants/:id/orders', adminController.getRestaurantOrders);

/**
 * @openapi
 * /api/v1/admin/restaurants/{id}:
 *   get:
 *     tags:
 *       - Admin Dashboard
 *     summary: Get profile details of a single restaurant by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique MongoDB ID of the restaurant
 *     responses:
 *       200:
 *         description: Restaurant details retrieved successfully
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
 *                     restaurant:
 *                       type: object
 *       404:
 *         description: Restaurant not found
 */
router.get('/restaurants/:id', checkPermission('restaurants.crud'), adminController.getRestaurantById);

/**
 * @openapi
 * /api/v1/admin/restaurants/{id}/orders:
 *   get:
 *     tags:
 *       - Admin Dashboard
 *     summary: Get all historical and pending orders for a specific restaurant
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique MongoDB ID of the restaurant
 *     responses:
 *       200:
 *         description: Restaurant order history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: integer
 *                   example: 12
 *                 data:
 *                   type: object
 *                   properties:
 *                     orders:
 *                       type: array
 *                       items:
 *                         type: object
 *       404:
 *         description: Restaurant not found
 */
router.get('/restaurants/:id/orders', checkPermission('orders.read'), adminController.getRestaurantOrders);

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
router.post('/restaurants/manual-signup', checkPermission('restaurants.crud', 'restaurants.onboard'), adminController.manuallyCreateRestaurant);

/**
 * @openapi
 * /api/v1/admin/orders/{id}:
 *   get:
 *     tags:
 *       - Admin Orders
 *     summary: Get details of a specific order
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
 *         description: Order details returned successfully
 */
router.get('/orders/:id', checkPermission('orders.read'), adminController.getOrderById);

/**
 * @openapi
 * /api/v1/admin/orders/{id}/status:
 *   patch:
 *     tags:
 *       - Admin Orders
 *     summary: Update status of a specific order
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
 *     responses:
 *       200:
 *         description: Order status updated successfully
 */
router.patch('/orders/:id/status', checkPermission('orders.accept', 'orders.dispatch'), adminController.updateOrderStatus);

/**
 * @openapi
 * /api/v1/admin/menu-items:
 *   get:
 *     tags:
 *       - Admin Menu Items
 *     summary: Get all menu items
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of menu items returned successfully
 *   post:
 *     tags:
 *       - Admin Menu Items
 *     summary: Create a new menu item
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price, restaurantId]
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               restaurantId:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               image:
 *                 type: string
 *     responses:
 *       201:
 *         description: Menu item created successfully
 */
router.get('/menu-items', checkPermission('restaurants.crud'), adminController.getAllMenuItems);

/**
 * @openapi
 * /api/v1/admin/menu-items/{id}:
 *   get:
 *     tags:
 *       - Admin Menu Items
 *     summary: Get details of a specific menu item
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
 *         description: Menu item details returned
 *   patch:
 *     tags:
 *       - Admin Menu Items
 *     summary: Update details of a menu item
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
 *               price:
 *                 type: number
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Menu item updated successfully
 *   delete:
 *     tags:
 *       - Admin Menu Items
 *     summary: Delete a menu item permanently
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
 *         description: Menu item deleted successfully
 */
import { upload } from '../utils/upload';

router.get('/menu-items/:id', checkPermission('restaurants.crud'), adminController.getMenuItemById);
router.post('/menu-items', checkPermission('restaurants.crud'), upload.single('image'), adminController.createMenuItem);
router.patch('/menu-items/:id', checkPermission('restaurants.crud'), upload.single('image'), adminController.updateMenuItem);
router.delete('/menu-items/:id', checkPermission('restaurants.crud'), adminController.deleteMenuItem);

/**
 * @openapi
 * /api/v1/admin/bookings:
 *   get:
 *     tags:
 *       - Admin Bookings
 *     summary: Get list of all restaurant table bookings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bookings list returned
 */
router.get('/bookings', checkPermission('orders.read'), adminController.getAllBookings);

/**
 * @openapi
 * /api/v1/admin/bookings/{id}:
 *   get:
 *     tags:
 *       - Admin Bookings
 *     summary: Get details of a booking
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
 *         description: Booking details returned
 */
router.get('/bookings/:id', checkPermission('orders.read'), adminController.getBookingById);

/**
 * @openapi
 * /api/v1/admin/bookings/{id}/status:
 *   patch:
 *     tags:
 *       - Admin Bookings
 *     summary: Update status of a booking
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
 *                 enum: [pending, confirmed, cancelled]
 *     responses:
 *       200:
 *         description: Booking status updated
 */
router.patch('/bookings/:id/status', checkPermission('orders.accept'), adminController.updateBookingStatus);

/**
 * @openapi
 * /api/v1/admin/transactions:
 *   get:
 *     tags:
 *       - Admin Transactions
 *     summary: Get list of all payment transactions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transactions list returned
 */
router.get('/transactions', checkPermission('payouts.manage'), adminController.getAllTransactions);

/**
 * @openapi
 * /api/v1/admin/transactions/{id}:
 *   get:
 *     tags:
 *       - Admin Transactions
 *     summary: Retrieve single transaction details by ID
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
 *         description: Transaction details returned successfully
 */
router.get('/transactions/:id', checkPermission('payouts.manage'), adminController.getTransactionById);

/**
 * @openapi
 * /api/v1/admin/transactions/{id}/status:
 *   patch:
 *     tags:
 *       - Admin Transactions
 *     summary: Update status of a payment transaction
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
 *                 enum: [pending, completed, failed]
 *     responses:
 *       200:
 *         description: Transaction status successfully updated
 */
router.patch('/transactions/:id/status', checkPermission('payouts.manage'), adminController.updateTransactionStatus);

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
router.get('/promos', checkPermission('promo.manage'), adminController.getAllPromos);
router.post('/promos', checkPermission('promo.manage'), adminController.createPromo);

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
router.patch('/promos/:id/status', checkPermission('promo.manage'), adminController.updatePromoStatus);

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
router.delete('/promos/:id', checkPermission('promo.manage'), adminController.deletePromo);

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
router.get('/notifications', checkPermission('notifications.broadcast'), adminController.getAllNotifications);

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
router.post('/notifications/broadcast', checkPermission('notifications.broadcast'), adminController.broadcastNotification);

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
router.post('/users', checkPermission('users.create'), adminController.createUser);

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
router.patch('/users/:id', checkPermission('users.update'), adminController.updateUser);
router.delete('/users/:id', checkPermission('users.delete'), adminController.deleteUser);

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
router.get('/roles-permissions', checkPermission(), adminController.getRolesPermissions);

/**
 * @openapi
 * /api/v1/admin/roles-permissions:
 *   post:
 *     tags:
 *       - Admin Roles
 *     summary: Create a new custom role with access permissions
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleName]
 *             properties:
 *               roleName:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Role config successfully created
 */
router.post('/roles-permissions', checkPermission(), adminController.createRolePermissions);

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
router.patch('/roles-permissions/:id', checkPermission(), adminController.updateRolePermissions);
router.delete('/roles-permissions/:id', checkPermission(), adminController.deleteRolePermissions);

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
router.get('/audit-logs', checkPermission(), adminController.getAuditLogs);

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
router.get('/system-logs', checkPermission(), adminController.getSystemLogs);

/**
 * @openapi
 * /api/v1/admin/referrals:
 *   get:
 *     tags:
 *       - Admin Referrals
 *     summary: Retrieve referral statistics and lists of referred users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referral tree and top referrer leaderboards returned
 */
router.get('/referrals', checkPermission('analytics.view'), adminController.getAllReferrals);

// Reviews
router.get('/reviews', checkPermission('users.read', 'restaurants.crud'), adminController.getAllReviews);
router.get('/reviews/:id', checkPermission('users.read'), adminController.getReviewById);
router.delete('/reviews/:id', checkPermission('users.delete'), adminController.deleteReview);

// Platform Settings
router.get('/settings', checkPermission(), adminController.getSettings);
router.patch('/settings', checkPermission(), adminController.updateSettings);

export default router;
