import { Response } from 'express';
import UserNotification from '../models/userNotification.model';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import { AuthRequest } from '../middleware/auth.middleware';

class NotificationController {
  /**
   * @openapi
   * /api/v1/notifications:
   *   get:
   *     tags:
   *       - Notifications
   *     summary: Get logged-in user's notifications
   *     description: Returns all notifications for the authenticated user, sorted newest first. Supports pagination via page/limit query params.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *         description: Notifications per page
   *     responses:
   *       200:
   *         description: List of notifications
   */
  public getMyNotifications = catchAsync(async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const notifications = await UserNotification.find({ user: req.user!._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await UserNotification.countDocuments({ user: req.user!._id });
    const unreadCount = await UserNotification.countDocuments({ user: req.user!._id, isRead: false });

    res.status(200).json({
      status: 'success',
      results: notifications.length,
      data: {
        notifications,
        unreadCount,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  /**
   * @openapi
   * /api/v1/notifications/{id}/read:
   *   patch:
   *     tags:
   *       - Notifications
   *     summary: Mark a single notification as read
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
   *       404:
   *         description: Notification not found
   */
  public markAsRead = catchAsync(async (req: AuthRequest, res: Response) => {
    const notification = await UserNotification.findOneAndUpdate(
      { _id: req.params.id, user: req.user!._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { notification },
    });
  });

  /**
   * @openapi
   * /api/v1/notifications/read-all:
   *   patch:
   *     tags:
   *       - Notifications
   *     summary: Mark all notifications as read for the logged-in user
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: All notifications marked as read
   */
  public markAllAsRead = catchAsync(async (req: AuthRequest, res: Response) => {
    await UserNotification.updateMany(
      { user: req.user!._id, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read',
    });
  });
}

export default new NotificationController();
