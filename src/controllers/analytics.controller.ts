import { NextFunction, Request, Response } from 'express';
import Order from '../models/order.model';
import Restaurant from '../models/restaurant.model';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import mongoose from 'mongoose';
import { AuthRequest } from '@/middleware/auth.middleware';

class AnalyticsController {
  getCustomerAnalytics(arg0: string, arg1: (req: AuthRequest, res: Response, next: NextFunction) => void, getCustomerAnalytics: any) {
    throw new Error('Method not implemented.');
  }
  /**
   * Vendor Dashboard: Get Revenue, Order Counts, and Top Items
   */
  public getVendorAnalytics = catchAsync(async (req: Request, res: Response) => {
    // Determine the restaurant ID. A vendor could have multiple, but we assume one for now.
    const restaurant = await Restaurant.findOne({ owner: req.user!._id });
    if (!restaurant) {
      throw new AppError('No restaurant found for this vendor', 404);
    }

    const restaurantId = restaurant._id;

    // Aggregate total revenue and order count
    const stats = await Order.aggregate([
      {
        $match: {
          restaurant: new mongoose.Types.ObjectId(restaurantId as unknown as string),
          status: 'delivered', // Only count completed orders
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' },
        },
      },
    ]);

    // Aggregate top selling items
    const topItems = await Order.aggregate([
      {
        $match: {
          restaurant: new mongoose.Types.ObjectId(restaurantId as unknown as string),
          status: 'delivered',
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          totalQuantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { totalQuantitySold: -1 } },
      { $limit: 5 },
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        stats: stats.length > 0 ? stats[0] : { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0 },
        topItems,
      },
    });
  });

  /**
   * Rider Dashboard: Get Earnings and Delivery Counts
   */
  public getRiderAnalytics = catchAsync(async (req: Request, res: Response) => {
    const riderId = req.user!._id;

    // For riders, the earnings typically come from the delivery fee.
    const stats = await Order.aggregate([
      {
        $match: {
          rider: new mongoose.Types.ObjectId(riderId as unknown as string),
          status: 'delivered',
        },
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$deliveryFee' },
          totalDeliveries: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        stats: stats.length > 0 ? stats[0] : { totalEarnings: 0, totalDeliveries: 0 },
      },
    });
  });
}

export default new AnalyticsController();
