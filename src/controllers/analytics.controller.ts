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

    // Aggregate completed orders for genuine real-time completion rate
    const completedStats = await Order.aggregate([
      {
        $match: {
          restaurant: restaurantId,
          ...dateMatch
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          delivered: {
            $sum: {
              $cond: [{ $in: ['$status', ['delivered', 'completed']] }, 1, 0]
            }
          }
        }
      }
    ]);

    const totalOrdersCount = completedStats.length > 0 ? completedStats[0].total : 0;
    const deliveredCount = completedStats.length > 0 ? completedStats[0].delivered : 0;
    const rawRate = totalOrdersCount > 0 ? (deliveredCount / totalOrdersCount) * 100 : 100;
    const completionRate = Math.round(rawRate * 10) / 10;

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

    // Aggregate real-time grouped chart distribution based on timeframe
    let chartData: number[] = [];

    if (timeframe === 'thismonth') {
      // 4 Weeks in month
      const weeklyBuckets = await Order.aggregate([
        {
          $match: {
            restaurant: restaurantId,
            status: { $in: activeStatuses },
            ...dateMatch,
          },
        },
        {
          $group: {
            _id: {
              $min: [4, { $ceil: { $divide: [{ $dayOfMonth: '$createdAt' }, 7] } }]
            },
            revenue: { $sum: '$totalAmount' },
          },
        },
      ]);
      const weekMap: Record<number, number> = {};
      weeklyBuckets.forEach((b: any) => { weekMap[b._id] = b.revenue; });
      chartData = [1, 2, 3, 4].map((w) => weekMap[w] || 0);
    } else if (timeframe === 'thisyear') {
      // 4 Quarters in year
      const quarterBuckets = await Order.aggregate([
        {
          $match: {
            restaurant: restaurantId,
            status: { $in: activeStatuses },
            ...dateMatch,
          },
        },
        {
          $group: {
            _id: {
              $ceil: { $divide: [{ $month: '$createdAt' }, 3] }
            },
            revenue: { $sum: '$totalAmount' },
          },
        },
      ]);
      const quarterMap: Record<number, number> = {};
      quarterBuckets.forEach((b: any) => { quarterMap[b._id] = b.revenue; });
      chartData = [1, 2, 3, 4].map((q) => quarterMap[q] || 0);
    } else {
      // Default: Days of the week (Mon to Sun: index 0 to 6)
      // Mongo $dayOfWeek returns 1 for Sunday, 2 for Monday ... 7 for Saturday
      const dailyBuckets = await Order.aggregate([
        {
          $match: {
            restaurant: restaurantId,
            status: { $in: activeStatuses },
            ...dateMatch,
          },
        },
        {
          $group: {
            _id: { $dayOfWeek: '$createdAt' },
            revenue: { $sum: '$totalAmount' },
          },
        },
      ]);

      // Map Mongo dayOfWeek (1=Sun, 2=Mon... 7=Sat) to Mon..Sun
      const dayMap: Record<number, number> = {};
      dailyBuckets.forEach((b: any) => { dayMap[b._id] = b.revenue; });
      chartData = [
        dayMap[2] || 0, // Mon
        dayMap[3] || 0, // Tue
        dayMap[4] || 0, // Wed
        dayMap[5] || 0, // Thu
        dayMap[6] || 0, // Fri
        dayMap[7] || 0, // Sat
        dayMap[1] || 0, // Sun
      ];
    }

    const calculatedStats = stats.length > 0 
      ? { 
          totalRevenue: stats[0].totalRevenue, 
          totalOrders: stats[0].totalOrders, 
          averageOrderValue: Math.round(stats[0].averageOrderValue || 0),
          completionRate
        }
      : { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0, completionRate };

    res.status(200).json({
      status: 'success',
      data: {
        stats: calculatedStats,
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
