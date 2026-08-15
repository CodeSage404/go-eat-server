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
    const activeStatuses = ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
    const { timeframe } = req.query;

    let dateMatch: any = {};
    if (timeframe) {
      const now = new Date();
      if (timeframe === 'thisweek') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        startOfWeek.setHours(0, 0, 0, 0);
        dateMatch = { createdAt: { $gte: startOfWeek } };
      } else if (timeframe === 'lastweek') {
        const endOfLastWeek = new Date(now.setDate(now.getDate() - now.getDay() - 1));
        endOfLastWeek.setHours(23, 59, 59, 999);
        const startOfLastWeek = new Date(endOfLastWeek);
        startOfLastWeek.setDate(startOfLastWeek.getDate() - 6);
        startOfLastWeek.setHours(0, 0, 0, 0);
        dateMatch = { createdAt: { $gte: startOfLastWeek, $lte: endOfLastWeek } };
      } else if (timeframe === 'thismonth') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateMatch = { createdAt: { $gte: startOfMonth } };
      } else if (timeframe === 'thisyear') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        dateMatch = { createdAt: { $gte: startOfYear } };
      }
    }

    // Aggregate total revenue and order count
    const stats = await Order.aggregate([
      {
        $match: {
          restaurant: restaurantId,
          status: { $in: activeStatuses }, // Count all active and completed orders
          ...dateMatch
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
          restaurant: restaurantId,
          status: { $in: activeStatuses },
          ...dateMatch
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

    // For now, generate a mock responsive chart data array from the backend, 
    // ideally this would group by day using $dayOfWeek or similar
    const chartData = [0, 12000, 8000, 20000, 16000, 25000, stats.length > 0 ? stats[0].totalRevenue : 32000];

    res.status(200).json({
      status: 'success',
      data: {
        stats: stats.length > 0 ? stats[0] : { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0 },
        topItems,
        chartData
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
