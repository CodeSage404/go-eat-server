import { Router } from 'express';
import reviewController from '../controllers/review.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router({ mergeParams: true }); // Merge restaurantId if needed

/**
 * @openapi
 * /api/v1/reviews/restaurant/{restaurantId}:
 *   get:
 *     tags:
 *       - Reviews
 *     summary: Get all reviews for a restaurant
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of reviews.
 */
router.get('/restaurant/:restaurantId', reviewController.getRestaurantReviews);

// Protected routes
router.use(protect);

/**
 * @openapi
 * /api/v1/reviews:
 *   post:
 *     tags:
 *       - Reviews
 *     summary: Post a review for an order
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, rating]
 *             properties:
 *               orderId:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Review created.
 */
router.post('/', reviewController.createReview);

/**
 * @openapi
 * /api/v1/reviews/my-reviews:
 *   get:
 *     tags:
 *       - Reviews
 *     summary: Get all reviews for the logged-in vendor's restaurant
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of vendor's reviews
 */
router.get('/my-reviews', restrictTo(UserRole.VENDOR), reviewController.getVendorReviews);

/**
 * @openapi
 * /api/v1/reviews/{id}/reply:
 *   post:
 *     tags:
 *       - Reviews
 *     summary: Reply to a review (Vendor only)
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
 *             required: [reply]
 *             properties:
 *               reply:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reply added successfully
 */
router.post('/:id/reply', restrictTo(UserRole.VENDOR), reviewController.replyToReview);

export default router;
