import { Router } from 'express';
import notificationController from '../controllers/notification.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// All notification routes require authentication
router.use(protect);

/**
 * @openapi
 * /api/v1/notifications:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: Get my notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user notifications
 */
router.get('/', notificationController.getMyNotifications);

/**
 * @openapi
 * /api/v1/notifications/read-all:
 *   patch:
 *     tags:
 *       - Notifications
 *     summary: Mark all notifications as read
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.patch('/read-all', notificationController.markAllAsRead);

/**
 * @openapi
 * /api/v1/notifications/{id}/read:
 *   patch:
 *     tags:
 *       - Notifications
 *     summary: Mark a notification as read
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
 *         description: Notification marked as read
 */
router.patch('/:id/read', notificationController.markAsRead);

/**
 * @openapi
 * /api/v1/notifications/test-push:
 *   post:
 *     tags:
 *       - Notifications
 *     summary: Send a test push notification to a user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: echinecherem729@gmail.com
 *               title:
 *                 type: string
 *                 example: Go-Eat Push Notification Test
 *               body:
 *                 type: string
 *                 example: Hello! Your push notification service is working properly.
 *     responses:
 *       200:
 *         description: Test notification dispatched
 */
router.post('/test-push', notificationController.sendTestPush);

export default router;

