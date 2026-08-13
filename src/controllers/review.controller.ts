import { Request, Response } from 'express';
import Review from '../models/review.model';
import Order, { OrderStatus } from '../models/order.model';
import Restaurant from '../models/restaurant.model';
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

  /**
   * Get all reviews for the logged-in vendor
   */
  public getVendorReviews = catchAsync(async (req: any, res: Response) => {
    const restaurant = await Restaurant.findOne({ owner: req.user._id });
    if (!restaurant) throw new AppError('No restaurant found for this vendor', 404);

    const reviews = await Review.find({ restaurant: restaurant._id })
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
  public replyToReview = catchAsync(async (req: any, res: Response) => {
    const { id } = req.params;
    const { reply } = req.body;

    const restaurant = await Restaurant.findOne({ owner: req.user._id });
    if (!restaurant) throw new AppError('No restaurant found for this vendor', 404);

    const review = await Review.findOne({ _id: id, restaurant: restaurant._id });
    if (!review) throw new AppError('Review not found or does not belong to your restaurant', 404);

    review.vendorReply = reply;
    review.vendorReplyDate = new Date();
    await review.save();

    res.status(200).json({
      status: 'success',
      data: { review },
    });
  });
}

export default new ReviewController();
