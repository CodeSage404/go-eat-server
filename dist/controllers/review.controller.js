"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const review_model_1 = __importDefault(require("../models/review.model"));
const order_model_1 = __importDefault(require("../models/order.model"));
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
class ReviewController {
    constructor() {
        /**
         * Create a new review for an order
         */
        this.createReview = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { orderId, rating, comment } = req.body;
            // 1. Check if order exists and belongs to user
            const order = await order_model_1.default.findById(orderId);
            if (!order)
                throw new appError_1.default('Order not found', 404);
            if (order.customer.toString() !== req.user._id.toString()) {
                throw new appError_1.default('You can only review your own orders', 403);
            }
            // 2. Check if a review already exists for this order
            const existingReview = await review_model_1.default.findOne({ order: orderId, user: req.user._id });
            if (existingReview) {
                throw new appError_1.default('You have already reviewed this order. Thank you!', 400);
            }
            // 3. Create review
            const review = await review_model_1.default.create({
                user: req.user._id,
                restaurant: order.restaurant,
                order: orderId,
                rating,
                comment,
            });
            res.status(201).json({
                status: 'success',
                data: { review },
            });
        });
        /**
         * Get all reviews for a restaurant
         */
        this.getRestaurantReviews = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const reviews = await review_model_1.default.find({ restaurant: req.params.restaurantId })
                .populate('user', 'name profileImage')
                .sort('-createdAt');
            res.status(200).json({
                status: 'success',
                results: reviews.length,
                data: { reviews },
            });
        });
        /**
         * Get all reviews for the logged-in vendor
         */
        this.getVendorReviews = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const restaurant = await restaurant_model_1.default.findOne({ owner: req.user._id });
            if (!restaurant)
                throw new appError_1.default('No restaurant found for this vendor', 404);
            const reviews = await review_model_1.default.find({ restaurant: restaurant._id })
                .populate('user', 'name profileImage')
                .sort('-createdAt');
            res.status(200).json({
                status: 'success',
                results: reviews.length,
                data: { reviews },
            });
        });
        /**
         * Vendor replies to a review
         */
        this.replyToReview = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const { reply } = req.body;
            const restaurant = await restaurant_model_1.default.findOne({ owner: req.user._id });
            if (!restaurant)
                throw new appError_1.default('No restaurant found for this vendor', 404);
            const review = await review_model_1.default.findOne({ _id: id, restaurant: restaurant._id });
            if (!review)
                throw new appError_1.default('Review not found or does not belong to your restaurant', 404);
            review.vendorReply = reply;
            review.vendorReplyDate = new Date();
            await review.save();
            res.status(200).json({
                status: 'success',
                data: { review },
            });
        });
    }
}
exports.default = new ReviewController();
