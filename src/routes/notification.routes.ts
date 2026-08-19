import { Router } from 'express';
import notificationController from '../controllers/notification.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// All notification routes require authentication
router.use(protect);

router.get('/', notificationController.getMyNotifications);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);

export default router;
