import { Router } from 'express';
import analyticsController from '../controllers/analytics.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

router.use(protect);

/**
 * @openapi
 * /api/v1/analytics/vendor:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get vendor dashboard statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Revenue, total orders, and top-selling items.
 */
router.get('/vendor', restrictTo(UserRole.VENDOR, UserRole.ADMIN), analyticsController.getVendorAnalytics);

/**
 * @openapi
 * /api/v1/analytics/rider:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get rider earnings and statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Total deliveries and earnings.
 */
router.get('/rider', restrictTo(UserRole.RIDER), analyticsController.getRiderAnalytics);

export default router;
