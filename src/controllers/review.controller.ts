import { Request, Response } from 'express';
import Review from '../models/review.model';
import Order, { OrderStatus } from '../models/order.model';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';

class ReviewController {
  /**
   * Create a new review for an order
   */
  public createReview = catchAsync(async (req: Request, res: Response) => {
    const { orderId, rating, comment } = req.body;

    // 1. Check if order exists and belongs to user
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);
    
    if (order.customer.toString() !== req.user!._id.toString()) {
      throw new AppError('You can only review your own orders', 403);
    }

    // 2. Check if a review already exists for this order
    const existingReview = await Review.findOne({ order: orderId, user: req.user!._id });
    if (existingReview) {
      throw new AppError('You have already reviewed this order. Thank you!', 400);
    }

    // 3. Create review
    const review = await Review.create({
      user: req.user!._id,
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
  public getRestaurantReviews = catchAsync(async (req: Request, res: Response) => {
    const reviews = await Review.find({ restaurant: req.params.restaurantId })
      .populate('user', 'name profileImage')
      .sort('-createdAt');

    res.status(200).json({
      status: 'success',
      results: reviews.length,
      data: { reviews },
    });
  });
}

export default new ReviewController();
