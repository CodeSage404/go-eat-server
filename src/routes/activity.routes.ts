import { Router, Response } from 'express';
import { protect, restrictTo, AuthRequest } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';
import activityService from '../services/activity.service';
import { catchAsync } from '../utils/catchAsync';

const router = Router();

/**
 * @openapi
 * /api/v1/activity/ping:
 *   post:
 *     tags:
 *       - Activity
 *     summary: Real-time user heartbeat and activity tracking
 *     description: Updates the authenticated user's lastActiveAt timestamp and registers their active device.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Unique hardware/app installation identifier
 *               deviceName:
 *                 type: string
 *                 description: Name or model of the device (e.g. iPhone 15 Pro, Samsung S24)
 *               platform:
 *                 type: string
 *                 description: Operating system or platform (e.g. ios, android, web)
 *     responses:
 *       200:
 *         description: Activity recorded successfully
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
 *                   example: Activity recorded
 */
router.post(
  '/ping',
  protect,
  catchAsync(async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const { deviceId, deviceName, platform } = req.body;
    const userAgent = (req.headers['user-agent'] as string) || '';
    const rawIp = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || '';
    const ipAddress = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '';

    await activityService.trackUserActivity(user._id.toString(), {
      deviceId,
      deviceName,
      platform,
      userAgent,
      ipAddress,
    });

    res.status(200).json({
      status: 'success',
      message: 'Activity recorded',
      data: {
        lastActiveAt: new Date(),
      },
    });
  })
);

/**
 * @openapi
 * /api/v1/activity/inactivity-scan:
 *   post:
 *     tags:
 *       - Activity
 *     summary: Trigger manual 7-day user inactivity re-engagement scan
 *     description: Scans for active customers who have not interacted with Go-Eat for 7+ days and dispatches re-engagement emails and push notifications.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inactivity scan executed successfully
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
 *                     scannedCount:
 *                       type: integer
 *                       example: 45
 *                     notifiedCount:
 *                       type: integer
 *                       example: 12
 *       403:
 *         description: Forbidden - Admin permission required
 */
router.post(
  '/inactivity-scan',
  protect,
  restrictTo(UserRole.ADMIN),
  catchAsync(async (req: AuthRequest, res: Response) => {
    const result = await activityService.checkInactiveUsersAndNotify();

    res.status(200).json({
      status: 'success',
      message: 'Inactivity scan executed successfully',
      data: result,
    });
  })
);

export default router;
