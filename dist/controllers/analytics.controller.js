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
            // Aggregate total revenue and order count
            const stats = await order_model_1.default.aggregate([
                {
                    $match: {
                        restaurant: new mongoose_1.default.Types.ObjectId(restaurantId),
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
            const topItems = await order_model_1.default.aggregate([
                {
                    $match: {
                        restaurant: new mongoose_1.default.Types.ObjectId(restaurantId),
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
