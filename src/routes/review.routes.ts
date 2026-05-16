import { Router } from 'express';
import reviewController from '../controllers/review.controller';
import { protect } from '../middleware/auth.middleware';

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

export default router;
