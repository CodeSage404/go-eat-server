"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const review_controller_1 = __importDefault(require("../controllers/review.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)({ mergeParams: true }); // Merge restaurantId if needed
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
router.get('/restaurant/:restaurantId', review_controller_1.default.getRestaurantReviews);
// Protected routes
router.use(auth_middleware_1.protect);
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
router.post('/', review_controller_1.default.createReview);
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
router.get('/my-reviews', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR), review_controller_1.default.getVendorReviews);
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
router.post('/:id/reply', (0, auth_middleware_1.restrictTo)(user_model_1.UserRole.VENDOR), review_controller_1.default.replyToReview);
exports.default = router;
