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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
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
         * Get all orders with optional status filtering for platform auditing
         */
        this.getAllOrders = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { status } = req.query;
            const filter = {};
            if (status)
                filter.status = status;
            const orders = await order_model_1.default.find(filter)
                .populate('customer', 'name email phoneNumber')
                .populate('restaurant', 'name')
                .populate('rider', 'name phoneNumber')
                .sort({ createdAt: -1 });
            res.status(200).json({
                status: 'success',
                results: orders.length,
                data: { orders }
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
        /**
         * Admin Login using environment credentials
         */
        this.adminLogin = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { email, password } = req.body;
            if (!email || !password) {
                throw new appError_1.default('Please provide email and password', 400);
            }
            const adminEmail = (process.env.ADMIN_EMAIL || 'admin@goeat.com').toLowerCase();
            const adminPass = process.env.ADMIN_PASS || 'AdminPass123!';
            if (email.toLowerCase() !== adminEmail || password !== adminPass) {
                throw new appError_1.default('Incorrect email or password', 401);
            }
            // Find or create admin user in DB to maintain integrity with authentication middleware
            let user = await user_model_1.default.findOne({ email: adminEmail }).select('+password');
            if (!user) {
                user = await user_model_1.default.create({
                    name: 'Platform Admin',
                    email: adminEmail,
                    password: adminPass,
                    role: user_model_1.UserRole.ADMIN,
                    status: user_model_1.UserStatus.ACTIVE,
                    isVerified: true,
                });
            }
            else {
                // Keep DB password in sync with process.env.ADMIN_PASS
                const isPasswordMatch = await user.comparePassword(adminPass);
                if (!isPasswordMatch) {
                    user.password = adminPass;
                    await user.save();
                }
            }
            // Sign JWT token
            const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET, {
                expiresIn: process.env.JWT_EXPIRES_IN || '90d',
            });
            user.password = undefined;
            res.status(200).json({
                status: 'success',
                token,
                data: {
                    user,
                },
            });
        });
        /**
         * Reset Admin Password (updates memory, file, and DB user)
         */
        this.adminResetPassword = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { currentPassword, newPassword } = req.body;
            if (!currentPassword || !newPassword) {
                throw new appError_1.default('Please provide current password and new password', 400);
            }
            if (newPassword.length < 8) {
                throw new appError_1.default('New password must be at least 8 characters long', 400);
            }
            const adminPass = process.env.ADMIN_PASS || 'AdminPass123!';
            if (currentPassword !== adminPass) {
                throw new appError_1.default('Current password is incorrect', 401);
            }
            // 1. Update in-memory env variable
            process.env.ADMIN_PASS = newPassword;
            // 2. Update .env file on disk
            try {
                const envPath = path_1.default.join(__dirname, '../../.env');
                if (fs_1.default.existsSync(envPath)) {
                    let envContent = fs_1.default.readFileSync(envPath, 'utf8');
                    // Match ADMIN_PASS=...
                    const regex = /^ADMIN_PASS=.*$/m;
                    if (regex.test(envContent)) {
                        envContent = envContent.replace(regex, `ADMIN_PASS=${newPassword}`);
                    }
                    else {
                        // If not found, append it
                        envContent += `\nADMIN_PASS=${newPassword}`;
                    }
                    fs_1.default.writeFileSync(envPath, envContent, 'utf8');
                }
            }
            catch (err) {
                console.error('Error updating .env file:', err);
            }
            // 3. Update database user password
            const adminEmail = (process.env.ADMIN_EMAIL || 'admin@goeat.com').toLowerCase();
            const user = await user_model_1.default.findOne({ email: adminEmail });
            if (user) {
                user.password = newPassword;
                await user.save();
            }
            res.status(200).json({
                status: 'success',
                message: 'Admin password reset successfully',
            });
        });
        /**
         * Manually create a vendor user and their restaurant profile
         */
        this.manuallyCreateRestaurant = (0, catchAsync_1.catchAsync)(async (req, res) => {
            // Supplying compatibility for both standard payload format & admin frontend onboarding form fields
            const name = req.body.restaurantName || req.body.businessName || req.body['Business Name'] || req.body['businessName'];
            const email = req.body.ownerEmail || req.body.emailAddress || req.body.platformUsername || req.body['Email Address'] || req.body['Platform Username'] || req.body['emailAddress'] || req.body['platformUsername'];
            const password = req.body.ownerPassword || req.body.loginPassword || req.body['Login Password'] || req.body['loginPassword'];
            const oName = req.body.ownerName || req.body['Owner Name'] || req.body['ownerName'] || 'Manual Owner';
            const phone = req.body.ownerPhone || req.body.phoneContact || req.body['Phone Contact'] || req.body['phoneContact'];
            const description = req.body.description || `Welcome to ${name}`;
            if (!email || !password || !name) {
                throw new appError_1.default('Please provide all required fields (email/username, password, and restaurant/business name)', 400);
            }
            // Check if user already exists
            const existingUser = await user_model_1.default.findOne({
                $or: [
                    { email: email.toLowerCase() },
                    ...(phone ? [{ phoneNumber: phone }] : [])
                ]
            });
            if (existingUser) {
                throw new appError_1.default('A user with this email or phone number already exists', 400);
            }
            // Create the vendor user
            const user = await user_model_1.default.create({
                name: oName,
                email: email.toLowerCase(),
                phoneNumber: phone,
                password: password,
                role: user_model_1.UserRole.VENDOR,
                status: user_model_1.UserStatus.ACTIVE,
                isVerified: true, // Auto-verified since created by admin
            });
            // Extract cuisine from different possible types/fields
            const rawCuisine = req.body.cuisine || req.body.restaurantCategory || req.body['Restaurant Category'] || req.body['restaurantCategory'];
            let cuisineArray = [];
            if (Array.isArray(rawCuisine)) {
                cuisineArray = rawCuisine;
            }
            else if (typeof rawCuisine === 'string') {
                cuisineArray = rawCuisine.split(',').map((c) => c.trim()).filter(Boolean);
            }
            // Fallbacks for DB schema required fields not present in Step 1/Step 5 of frontend manual onboarding
            const finalAddress = req.body.address || {
                street: 'Manual Onboarding',
                city: 'Unknown',
                state: 'Unknown',
                zipCode: '000000'
            };
            const finalLocation = req.body.location || {
                type: 'Point',
                coordinates: [0, 0]
            };
            const finalOpeningHours = req.body.openingHours || {
                open: '08:00',
                close: '22:00'
            };
            // Create the restaurant
            const restaurant = await restaurant_model_1.default.create({
                owner: user._id,
                name: name,
                description: description,
                address: finalAddress,
                location: finalLocation,
                cuisine: cuisineArray,
                openingHours: finalOpeningHours,
                status: restaurant_model_1.RestaurantStatus.ACTIVE, // Auto-approved
            });
            res.status(201).json({
                status: 'success',
                message: 'Vendor and restaurant successfully created',
                data: {
                    user,
                    restaurant
                }
            });
        });
    }
}
exports.default = new AdminController();
