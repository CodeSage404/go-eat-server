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
const user_model_1 = __importStar(require("../models/user.model"));
const restaurant_model_1 = __importStar(require("../models/restaurant.model"));
const order_model_1 = __importStar(require("../models/order.model"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
class AdminController {
    constructor() {
        /**
         * Get platform-wide statistics for the super-admin dashboard
         */
        this.getPlatformStats = (0, catchAsync_1.catchAsync)(async (req, res) => {
            // User count breakdown
            const userStats = await user_model_1.default.aggregate([
                { $group: { _id: '$role', count: { $sum: 1 } } }
            ]);
            // Order status breakdown
            const orderStats = await order_model_1.default.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]);
            // Financial summaries
            const financialStats = await order_model_1.default.aggregate([
                { $match: { status: order_model_1.OrderStatus.DELIVERED } },
                {
                    $group: {
                        _id: null,
                        totalSales: { $sum: '$totalAmount' },
                        totalDeliveryFees: { $sum: '$deliveryFee' },
                        totalCommission: { $sum: { $multiply: ['$totalAmount', 0.1] } }, // 10% platform commission
                        count: { $sum: 1 }
                    }
                }
            ]);
            const activeVendors = await restaurant_model_1.default.countDocuments({ status: restaurant_model_1.RestaurantStatus.ACTIVE });
            const pendingVendors = await restaurant_model_1.default.countDocuments({ status: restaurant_model_1.RestaurantStatus.PENDING });
            res.status(200).json({
                status: 'success',
                data: {
                    users: userStats,
                    orders: orderStats,
                    financials: financialStats[0] || {
                        totalSales: 0,
                        totalDeliveryFees: 0,
                        totalCommission: 0,
                        count: 0
                    },
                    restaurants: {
                        active: activeVendors,
                        pending: pendingVendors
                    }
                }
            });
        });
        /**
         * Get all users (Customers, Vendors, Riders) with pagination & filters
         */
        this.getAllUsers = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { role, status } = req.query;
            const filter = {};
            if (role)
                filter.role = role;
            if (status)
                filter.status = status;
            const users = await user_model_1.default.find(filter).select('-password');
            res.status(200).json({
                status: 'success',
                results: users.length,
                data: { users }
            });
        });
        /**
         * Update any user's status (Suspend/Activate)
         */
        this.updateUserStatus = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;
            if (!Object.values(user_model_1.UserStatus).includes(status)) {
                throw new appError_1.default('Invalid status value', 400);
            }
            const user = await user_model_1.default.findByIdAndUpdate(id, { status }, { new: true, runValidators: true }).select('-password');
            if (!user) {
                throw new appError_1.default('User not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: `User status successfully updated to ${status}`,
                data: { user }
            });
        });
        /**
         * Get all restaurants (including inactive, pending approval ones)
         */
        this.getAllRestaurants = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { status } = req.query;
            const filter = {};
            if (status)
                filter.status = status;
            const restaurants = await restaurant_model_1.default.find(filter).populate('owner', 'name email phoneNumber');
            res.status(200).json({
                status: 'success',
                results: restaurants.length,
                data: { restaurants }
            });
        });
        /**
         * Approve or Suspend a restaurant (Critical for Marketplace Quality Control)
         */
        this.updateRestaurantStatus = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;
            if (!Object.values(restaurant_model_1.RestaurantStatus).includes(status)) {
                throw new appError_1.default('Invalid status value', 400);
            }
            const restaurant = await restaurant_model_1.default.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
            if (!restaurant) {
                throw new appError_1.default('Restaurant not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: `Restaurant status successfully updated to ${status}`,
                data: { restaurant }
            });
        });
    }
}
exports.default = new AdminController();
