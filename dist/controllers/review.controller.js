"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const review_model_1 = __importDefault(require("../models/review.model"));
const order_model_1 = __importStar(require("../models/order.model"));
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
            // 2. Only delivered orders can be reviewed
            if (order.status !== order_model_1.OrderStatus.DELIVERED) {
                throw new appError_1.default('You can only review delivered orders', 400);
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
    }
}
exports.default = new ReviewController();
