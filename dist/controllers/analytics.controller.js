"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const order_model_1 = __importDefault(require("../models/order.model"));
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const mongoose_1 = __importDefault(require("mongoose"));
class AnalyticsController {
    constructor() {
        /**
         * Vendor Dashboard: Get Revenue, Order Counts, and Top Items
         */
        this.getVendorAnalytics = (0, catchAsync_1.catchAsync)(async (req, res) => {
            // Determine the restaurant ID. A vendor could have multiple, but we assume one for now.
            const restaurant = await restaurant_model_1.default.findOne({ owner: req.user._id });
            if (!restaurant) {
                throw new appError_1.default('No restaurant found for this vendor', 404);
            }
            const restaurantId = restaurant._id;
            const activeStatuses = ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
            const { timeframe } = req.query;
            let dateMatch = {};
            if (timeframe) {
                const now = new Date();
                if (timeframe === 'thisweek') {
                    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
                    startOfWeek.setHours(0, 0, 0, 0);
                    dateMatch = { createdAt: { $gte: startOfWeek } };
                }
                else if (timeframe === 'lastweek') {
                    const endOfLastWeek = new Date(now.setDate(now.getDate() - now.getDay() - 1));
                    endOfLastWeek.setHours(23, 59, 59, 999);
                    const startOfLastWeek = new Date(endOfLastWeek);
                    startOfLastWeek.setDate(startOfLastWeek.getDate() - 6);
                    startOfLastWeek.setHours(0, 0, 0, 0);
                    dateMatch = { createdAt: { $gte: startOfLastWeek, $lte: endOfLastWeek } };
                }
                else if (timeframe === 'thismonth') {
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    dateMatch = { createdAt: { $gte: startOfMonth } };
                }
                else if (timeframe === 'thisyear') {
                    const startOfYear = new Date(now.getFullYear(), 0, 1);
                    dateMatch = { createdAt: { $gte: startOfYear } };
                }
            }
            // Aggregate total revenue and order count
            const stats = await order_model_1.default.aggregate([
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
            const topItems = await order_model_1.default.aggregate([
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
        this.getRiderAnalytics = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const riderId = req.user._id;
            // For riders, the earnings typically come from the delivery fee.
            const stats = await order_model_1.default.aggregate([
                {
                    $match: {
                        rider: new mongoose_1.default.Types.ObjectId(riderId),
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
    getCustomerAnalytics(arg0, arg1, getCustomerAnalytics) {
        throw new Error('Method not implemented.');
    }
}
exports.default = new AnalyticsController();
