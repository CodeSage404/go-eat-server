import { Router } from 'express';
import userController from '../controllers/user.controller';
import authController from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

/**
 * @openapi
 * /api/v1/users/buddy/respond:
 *   get:
 *     tags:
 *       - Users
 *     summary: Respond to GoEatOne Buddy Invitation
 *     description: Public web callback allowing a designated buddy to accept or decline an invitation via mobile browser.
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Cryptographic invitation token.
 *       - in: query
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [accept, decline]
 *         description: Action to perform on the invitation.
 *     responses:
 *       200:
 *         description: HTML webpage confirming action status.
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       400:
 *         description: Missing or invalid token or action query parameters.
 *       404:
 *         description: Invitation token has expired or is invalid.
 */
router.get('/buddy/respond', userController.respondToBuddyInvite);

router.use(protect);

/**
 * @openapi
 * /api/v1/users/location:
 *   put:
 *     tags:
 *       - Users
 *     summary: Persist User Location to Database
 *     description: Saves the user's detected or manually selected address string and coordinates [lng, lat] to their MongoDB user profile.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, coordinates]
 *             properties:
 *               address:
 *                 type: string
 *                 example: Agbani, Enugu, Nigeria
 *               coordinates:
 *                 type: array
 *                 items:
 *                   type: number
 *                 example: [7.5191, 6.3084]
 *               country:
 *                 type: string
 *                 example: Nigeria
 *               countryCode:
 *                 type: string
 *                 example: NG
 *               isNigeria:
 *                 type: boolean
 *                 example: true
 *               isItaly:
 *                 type: boolean
 *                 example: false
 *               isUk:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: User location saved to database successfully.
 *       400:
 *         description: Missing address or coordinates.
 */
router.put('/location', authController.updateUserLocation);

/**
 * @openapi
 * /api/v1/users/addresses:
 *   get:
 *     tags:
 *       - Addresses
 *     summary: Get all saved addresses
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved addresses.
 *   post:
 *     tags:
 *       - Addresses
 *     summary: Save a new address
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [label, address, location]
 *             properties:
 *               label:
 *                 type: string
 *                 example: Home
 *               address:
 *                 type: string
 *                 example: 123 Main St, London
 *               location:
 *                 type: object
 *                 properties:
 *                   type: { type: string, example: Point }
 *                   coordinates: { type: array, items: { type: number }, example: [51.5074, -0.1278] }
 *               isDefault:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Address saved.
 */
router.route('/addresses')
  .get(userController.getAddresses)
  .post(userController.addAddress);

/**
 * @openapi
 * /api/v1/users/addresses/{id}:
 *   delete:
 *     tags:
 *       - Addresses
 *     summary: Remove a saved address
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
 *         description: Address removed.
 */
router.delete('/addresses/:id', userController.deleteAddress);

/**
 * @openapi
 * /api/v1/users/favorites:
 *   get:
 *     tags:
 *       - Favorites
 *     summary: Get favorite restaurants
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of favorited restaurants.
 *   post:
 *     tags:
 *       - Favorites
 *     summary: Toggle restaurant favorite
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [restaurantId]
 *             properties:
 *               restaurantId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated favorites list.
 */
router.route('/favorites')
  .get(userController.getFavorites)
  .post(userController.toggleFavorite);

/**
 * @openapi
 * /api/v1/users/profile:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get authenticated user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully.
 *   put:
 *     tags:
 *       - Users
 *     summary: Update user profile
 *     security:
 *       - bearerAuth: []
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
 *               profileImage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully.
 */
router.route('/profile')
  .get(userController.getProfile)
  .put(userController.updateProfile);

/**
 * @openapi
 * /api/v1/users/update-me:
 *   patch:
 *     tags:
 *       - Users
 *     summary: Update courier/user profile details
 *     description: Updates personal and vehicle details for the authenticated user profile.
 *     security:
 *       - bearerAuth: []
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
 *               vehicleType:
 *                 type: string
 *               vehicleNumber:
 *                 type: string
 *               profileImage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully.
 */
router.patch('/update-me', userController.updateProfile);

/**
 * @openapi
 * /api/v1/users/fcm-token:
 *   patch:
 *     tags:
 *       - Users
 *     summary: Update User FCM Push Notification Token
 *     description: Stores or updates the user's Expo / Firebase Cloud Messaging push notification token in MongoDB.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fcmToken]
 *             properties:
 *               fcmToken:
 *                 type: string
 *                 example: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 *     responses:
 *       200:
 *         description: FCM push token updated successfully.
 *       400:
 *         description: FCM token is required.
 */
router.patch('/fcm-token', userController.updateFcmToken);

/**
 * @openapi
 * /api/v1/users/status/toggle-online:
 *   patch:
 *     tags:
 *       - Users
 *     summary: Toggle Rider / Vendor Online Shift Status
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isOnline]
 *             properties:
 *               isOnline:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Online shift status updated successfully.
 */
router.patch('/status/toggle-online', userController.toggleOnlineStatus);

/**
 * @openapi
 * /api/v1/users/responsible-purchasing:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get User Responsible Purchasing & GoEat Buddy Settings
 *     description: Retrieves the authenticated user's alcohol spending limit, order limit, take-a-break pause dates, and GoEat Buddy details.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Responsible purchasing settings retrieved successfully.
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
 *                     responsiblePurchasing:
 *                       type: object
 *       401:
 *         description: Unauthorized. Invalid or missing authentication token.
 *   put:
 *     tags:
 *       - Users
 *     summary: Update User Responsible Purchasing & GoEat Buddy Settings
 *     description: Updates the authenticated user's responsible purchasing preferences including budget limits, order limits, pause periods, and buddy invitations.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [responsiblePurchasing]
 *             properties:
 *               responsiblePurchasing:
 *                 type: object
 *                 properties:
 *                   spendingLimit:
 *                     type: object
 *                     properties:
 *                       enabled: { type: boolean, example: true }
 *                       amount: { type: number, example: 50 }
 *                       period: { type: string, enum: [week, month], example: week }
 *                       currencyCode: { type: string, example: GBP }
 *                   orderLimit:
 *                     type: object
 *                     properties:
 *                       enabled: { type: boolean, example: true }
 *                       maxOrders: { type: number, example: 2 }
 *                       period: { type: string, enum: [week, month], example: week }
 *                   takeABreak:
 *                     type: object
 *                     properties:
 *                       enabled: { type: boolean, example: true }
 *                       activeUntil: { type: string, format: date-time }
 *                       durationDays: { type: number, example: 7 }
 *                   buddy:
 *                     type: object
 *                     properties:
 *                       name: { type: string, example: Jane Doe }
 *                       contact: { type: string, example: jane@example.com }
 *                       relationship: { type: string, example: Friend }
 *                       is18PlusConfirmed: { type: boolean, example: true }
 *     responses:
 *       200:
 *         description: Responsible purchasing settings updated successfully.
 *       400:
 *         description: Missing or invalid settings payload.
 *       401:
 *         description: Unauthorized. Invalid or missing authentication token.
 */
router.route('/responsible-purchasing')
  .get(userController.getResponsiblePurchasing)
  .put(userController.updateResponsiblePurchasing);

/**
 * @openapi
 * /api/v1/users/buddy/resend-invite:
 *   post:
 *     tags:
 *       - Users
 *     summary: Resend GoEatOne Buddy Invitation
 *     description: Re-dispatches an SMS or email invitation with a refreshed invitation token to the currently designated buddy.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Invitation resent successfully.
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
 *                   example: Invitation resent to Jane Doe
 *       400:
 *         description: No buddy has been designated on this account.
 *       401:
 *         description: Unauthorized. Missing or invalid authentication token.
 *       404:
 *         description: User profile not found.
 */
router.post('/buddy/resend-invite', userController.resendBuddyInvite);

export default router;

