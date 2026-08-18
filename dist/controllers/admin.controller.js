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
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = __importStar(require("../models/user.model"));
const restaurant_model_1 = __importStar(require("../models/restaurant.model"));
const order_model_1 = __importStar(require("../models/order.model"));
const transaction_model_1 = __importDefault(require("../models/transaction.model"));
const foodItem_model_1 = __importDefault(require("../models/foodItem.model"));
const auditLog_model_1 = __importDefault(require("../models/auditLog.model"));
const systemLog_model_1 = __importDefault(require("../models/systemLog.model"));
const booking_model_1 = __importDefault(require("../models/booking.model"));
const promo_model_1 = __importDefault(require("../models/promo.model"));
const notification_model_1 = __importDefault(require("../models/notification.model"));
const role_model_1 = __importDefault(require("../models/role.model"));
const review_model_1 = __importDefault(require("../models/review.model"));
const setting_model_1 = __importDefault(require("../models/setting.model"));
const category_model_1 = __importDefault(require("../models/category.model"));
const notification_service_1 = __importDefault(require("../services/notification.service"));
const email_util_1 = __importDefault(require("../utils/email.util"));
const sms_util_1 = require("../utils/sms.util");
const logger_1 = __importDefault(require("../utils/logger"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
class AdminController {
    constructor() {
        /**
         * Get platform-wide statistics for the super-admin dashboard
         */
        this.getPlatformStats = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const regionFilter = this.getRegionFilter(req);
            // User count breakdown
            const userStats = await user_model_1.default.aggregate([
                { $match: regionFilter },
                { $group: { _id: '$role', count: { $sum: 1 } } },
            ]);
            // Users by country breakdown
            const usersByCountry = await user_model_1.default.aggregate([
                { $group: { _id: '$country', count: { $sum: 1 } } },
            ]);
            // Order status breakdown
            const orderStats = await order_model_1.default.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
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
                        count: { $sum: 1 },
                    },
                },
            ]);
            const activeVendors = await restaurant_model_1.default.countDocuments({ status: restaurant_model_1.RestaurantStatus.ACTIVE });
            const pendingVendors = await restaurant_model_1.default.countDocuments({ status: restaurant_model_1.RestaurantStatus.PENDING });
            res.status(200).json({
                status: 'success',
                data: {
                    users: userStats,
                    usersByCountry,
                    orders: orderStats,
                    financials: financialStats[0] || {
                        totalSales: 0,
                        totalDeliveryFees: 0,
                        totalCommission: 0,
                        count: 0,
                    },
                    restaurants: {
                        active: activeVendors,
                        pending: pendingVendors,
                    },
                },
            });
        });
        /**
         * Get all users (Customers, Vendors, Riders) with pagination & filters
         */
        this.getAllUsers = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { role, status } = req.query;
            const filter = {};
            if (role && role !== 'all')
                filter.role = role;
            if (status && status !== 'all')
                filter.status = status;
            const regionFilter = this.getRegionFilter(req);
            Object.assign(filter, regionFilter);
            const users = await user_model_1.default.find(filter).select('-password').sort({ createdAt: -1 });
            res.status(200).json({
                status: 'success',
                results: users.length,
                data: { users },
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
            let user;
            if (email.toLowerCase() === adminEmail) {
                if (password !== adminPass) {
                    throw new appError_1.default('Incorrect email or password', 401);
                }
                user = await user_model_1.default.findOne({ email: adminEmail }).select('+password');
                if (!user) {
                    user = await user_model_1.default.create({
                        name: 'Platform Admin',
                        email: adminEmail,
                        password: adminPass,
                        role: user_model_1.UserRole.ADMIN,
                        customRole: 'super-admin',
                        status: user_model_1.UserStatus.ACTIVE,
                        isVerified: true,
                    });
                }
                else {
                    const isPasswordMatch = await user.comparePassword(adminPass);
                    if (!isPasswordMatch) {
                        user.password = adminPass;
                        await user.save();
                    }
                }
            }
            else {
                user = await user_model_1.default.findOne({ email: email.toLowerCase() }).select('+password');
                if (!user || user.role !== user_model_1.UserRole.ADMIN) {
                    throw new appError_1.default('Incorrect email or password', 401);
                }
                const isPasswordMatch = await user.comparePassword(password);
                if (!isPasswordMatch) {
                    throw new appError_1.default('Incorrect email or password', 401);
                }
                if (user.status !== user_model_1.UserStatus.ACTIVE) {
                    throw new appError_1.default('Your account has been suspended. Please contact support.', 403);
                }
            }
            // Sign JWT token
            const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET, {
                expiresIn: process.env.JWT_EXPIRES_IN || '365d',
            });
            user.password = undefined;
            // Resolve permissions for the login response
            let permissions = [];
            if (!user.customRole || user.customRole === 'super-admin') {
                permissions = [
                    'users.create', 'users.read', 'users.update', 'users.suspend', 'users.delete',
                    'restaurants.approve', 'restaurants.suspend', 'restaurants.crud',
                    'orders.read', 'orders.dispatch', 'orders.accept',
                    'payouts.manage', 'analytics.view', 'promo.manage', 'notifications.broadcast'
                ];
            }
            else {
                const rolePerm = await role_model_1.default.findOne({ roleName: user.customRole });
                permissions = rolePerm ? rolePerm.permissions : [];
            }
            res.status(200).json({
                status: 'success',
                token,
                data: {
                    user: {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        customRole: user.customRole || 'super-admin',
                        status: user.status,
                        isVerified: user.isVerified,
                        permissions
                    },
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
            // Update in-memory env variable
            process.env.ADMIN_PASS = newPassword;
            // Update .env file on disk
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
            const name = req.body.restaurantName || req.body.businessName || req.body['Business Name'] || req.body['businessName'];
            const email = req.body.ownerEmail || req.body.emailAddress || req.body.platformUsername || req.body['Email Address'] || req.body['Platform Username'] || req.body['emailAddress'] || req.body['platformUsername'];
            // Automatically generate a secure cryptographic random password for manually onboarded vendors
            const randomHex = crypto_1.default.randomBytes(6).toString('hex').toUpperCase();
            const password = `GoEat#${randomHex}9!`;
            const oName = req.body.ownerName || req.body['Owner Name'] || req.body['ownerName'] || 'Manual Owner';
            const phone = req.body.ownerPhone || req.body.phoneContact || req.body['Phone Contact'] || req.body['phoneContact'];
            const description = req.body.description || `Welcome to ${name}`;
            if (!email || !name) {
                throw new appError_1.default('Please provide all required fields (email/username and restaurant/business name)', 400);
            }
            // Check if user already exists
            const existingUser = await user_model_1.default.findOne({
                $or: [
                    { email: email.toLowerCase() },
                    ...(phone ? [{ phoneNumber: phone }] : [])
                ]
            });
            if (existingUser) {
                if (existingUser.role === user_model_1.UserRole.VENDOR) {
                    const hasRestaurant = await restaurant_model_1.default.findOne({ owner: existingUser._id });
                    if (!hasRestaurant) {
                        // Self-healing: Clean up dangling vendor user with no restaurant
                        await user_model_1.default.findByIdAndDelete(existingUser._id);
                    }
                    else {
                        throw new appError_1.default('A user with this email or phone number already exists', 400);
                    }
                }
                else {
                    throw new appError_1.default('A user with this email or phone number already exists', 400);
                }
            }
            // Create the vendor user
            const user = await user_model_1.default.create({
                name: oName,
                email: email.toLowerCase(),
                phoneNumber: phone || undefined,
                password: password,
                role: user_model_1.UserRole.VENDOR,
                status: user_model_1.UserStatus.ACTIVE,
                isVerified: true,
            });
            // Extract cuisine from different possible types/fields
            const rawCuisine = req.body.cuisine || req.body.restaurantCategory || req.body['Restaurant Category'] || req.body['restaurantCategory'];
            let cuisineArray = [];
            if (Array.isArray(rawCuisine)) {
                cuisineArray = rawCuisine;
            }
            else if (typeof rawCuisine === 'string') {
                try {
                    const parsed = JSON.parse(rawCuisine);
                    if (Array.isArray(parsed)) {
                        cuisineArray = parsed;
                    }
                    else {
                        cuisineArray = rawCuisine.split(',').map((c) => c.trim()).filter(Boolean);
                    }
                }
                catch {
                    cuisineArray = rawCuisine.split(',').map((c) => c.trim()).filter(Boolean);
                }
            }
            // Fallbacks for DB schema required fields not present in Step 1/Step 5 of frontend manual onboarding
            let finalAddress = {
                street: 'Manual Onboarding',
                city: 'Unknown',
                state: 'Unknown',
                zipCode: '000000'
            };
            if (req.body.address) {
                try {
                    finalAddress = typeof req.body.address === 'string' ? JSON.parse(req.body.address) : req.body.address;
                }
                catch (e) { }
            }
            let finalLocation = {
                type: 'Point',
                coordinates: [3.3792, 6.5244]
            };
            if (req.body.location) {
                try {
                    const parsed = typeof req.body.location === 'string' ? JSON.parse(req.body.location) : req.body.location;
                    if (parsed?.coordinates && Array.isArray(parsed.coordinates)) {
                        finalLocation = parsed;
                    }
                }
                catch (e) { }
            }
            else if (req.body.lng && req.body.lat) {
                finalLocation = {
                    type: 'Point',
                    coordinates: [Number(req.body.lng) || 3.3792, Number(req.body.lat) || 6.5244]
                };
            }
            let finalOpeningHours = {
                open: '08:00',
                close: '22:00'
            };
            if (req.body.openingHours) {
                try {
                    finalOpeningHours = typeof req.body.openingHours === 'string' ? JSON.parse(req.body.openingHours) : req.body.openingHours;
                }
                catch (e) { }
            }
            let images = {
                logo: 'default-logo.png',
                cover: 'default-cover.png'
            };
            if (req.files) {
                const files = req.files;
                if (files['logo'] && files['logo'][0]) {
                    images.logo = files['logo'][0].path.startsWith('http') ? files['logo'][0].path : `/uploads/${files['logo'][0].filename}`;
                }
                if (files['cover'] && files['cover'][0]) {
                    images.cover = files['cover'][0].path.startsWith('http') ? files['cover'][0].path : `/uploads/${files['cover'][0].filename}`;
                }
            }
            try {
                // Create the restaurant
                const restaurant = await restaurant_model_1.default.create({
                    owner: user._id,
                    name: name,
                    description: description,
                    address: finalAddress,
                    location: finalLocation,
                    cuisine: cuisineArray,
                    openingHours: finalOpeningHours,
                    outletType: req.body.outletType || 'Restaurant',
                    baseCurrency: req.body.baseCurrency || 'NGN',
                    status: restaurant_model_1.RestaurantStatus.ACTIVE, // Auto-approved
                    images: images,
                });
                // Send Welcome / Partner email to the vendor owner!
                try {
                    await email_util_1.default.sendTemplateEmail(email.toLowerCase(), 'WELCOME_PARTNER', 'Welcome to the Go-Eat Family — Partner Onboarding Successful!', {
                        partnerName: oName,
                        restaurantName: name,
                        loginUrl: process.env.VENDOR_DASHBOARD_URL || 'https://partner.goeat.com',
                        email: email.toLowerCase(),
                        password
                    }, 'partners');
                }
                catch (mailErr) {
                    console.error('Failed to send partner onboarding welcome email:', mailErr);
                }
                res.status(201).json({
                    status: 'success',
                    message: 'Vendor and restaurant successfully created',
                    data: {
                        user,
                        restaurant
                    }
                });
            }
            catch (err) {
                // Clean up newly created user on failure
                await user_model_1.default.findByIdAndDelete(user._id);
                throw err;
            }
        });
        /**
         * Get profile details of a single restaurant by ID
         */
        this.getRestaurantById = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const restaurant = await restaurant_model_1.default.findById(id).populate('owner', 'name email phoneNumber');
            if (!restaurant) {
                throw new appError_1.default('Restaurant not found', 404);
            }
            res.status(200).json({
                status: 'success',
                data: { restaurant }
            });
        });
        /**
         * Get historical and pending orders for a specific restaurant
         */
        this.getRestaurantOrders = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const orders = await order_model_1.default.find({ restaurant: id })
                .populate('customer', 'name email phoneNumber')
                .populate('rider', 'name phoneNumber')
                .sort({ createdAt: -1 });
            res.status(200).json({
                status: 'success',
                results: orders.length,
                data: { orders }
            });
        });
        /**
         * Get all menu items across all restaurants
         */
        this.getAllMenuItems = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const items = await foodItem_model_1.default.find()
                .populate('category', 'name')
                .populate('restaurant', 'name')
                .sort({ createdAt: -1 });
            res.status(200).json({
                status: 'success',
                results: items.length,
                data: { items }
            });
        });
        /**
         * Get detail of a specific order
         */
        this.getOrderById = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const order = await order_model_1.default.findById(id)
                .populate('customer', 'name email phoneNumber')
                .populate('restaurant', 'name address location phoneContact')
                .populate('rider', 'name phoneNumber');
            if (!order) {
                throw new appError_1.default('Order not found', 404);
            }
            res.status(200).json({
                status: 'success',
                data: { order }
            });
        });
        /**
         * Update order status (Admin Override)
         */
        this.updateOrderStatus = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;
            const order = await order_model_1.default.findByIdAndUpdate(id, { status }, { new: true, runValidators: true })
                .populate('customer', 'name email phoneNumber')
                .populate('restaurant', 'name address location phoneContact')
                .populate('rider', 'name phoneNumber');
            if (!order) {
                throw new appError_1.default('Order not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: 'Order status updated successfully',
                data: { order }
            });
        });
        /**
         * Get all platform audit logs
         */
        this.getAuditLogs = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const logs = await auditLog_model_1.default.find().sort({ createdAt: -1 });
            res.status(200).json({
                status: 'success',
                results: logs.length,
                data: { logs }
            });
        });
        /**
         * Get all platform system logs
         */
        this.getSystemLogs = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const logs = await systemLog_model_1.default.find().sort({ createdAt: -1 });
            res.status(200).json({
                status: 'success',
                results: logs.length,
                data: { logs }
            });
        });
        /**
         * Refresh admin JWT token
         */
        this.refreshAdminToken = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const token = jsonwebtoken_1.default.sign({ id: req.user._id }, process.env.JWT_SECRET, {
                expiresIn: process.env.JWT_EXPIRES_IN || '365d',
            });
            res.status(200).json({
                status: 'success',
                token,
                data: {
                    user: req.user
                }
            });
        });
        /**
         * Get all bookings
         */
        this.getAllBookings = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const bookings = await booking_model_1.default.find()
                .populate('customer', 'name email phoneNumber')
                .populate('restaurant', 'name')
                .sort({ createdAt: -1 });
            res.status(200).json({
                status: 'success',
                results: bookings.length,
                data: { bookings }
            });
        });
        /**
         * Get single booking by ID
         */
        this.getBookingById = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const booking = await booking_model_1.default.findById(req.params.id)
                .populate('customer', 'name email phoneNumber')
                .populate('restaurant', 'name address');
            if (!booking) {
                throw new appError_1.default('Booking not found', 404);
            }
            res.status(200).json({
                status: 'success',
                data: { booking }
            });
        });
        /**
         * Update booking status
         */
        this.updateBookingStatus = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { status } = req.body;
            if (!['confirmed', 'cancelled'].includes(status)) {
                throw new appError_1.default('Invalid booking status', 400);
            }
            const booking = await booking_model_1.default.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
            if (!booking) {
                throw new appError_1.default('Booking not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: `Booking has been successfully ${status}`,
                data: { booking }
            });
        });
        /**
         * Get all transactions
         */
        this.getAllTransactions = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const transactions = await transaction_model_1.default.find()
                .populate({
                path: 'wallet',
                populate: {
                    path: 'user',
                    select: 'name email role'
                }
            })
                .sort({ createdAt: -1 });
            res.status(200).json({
                status: 'success',
                results: transactions.length,
                data: { transactions }
            });
        });
        /**
         * Get single transaction details by ID
         */
        this.getTransactionById = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const transaction = await transaction_model_1.default.findById(req.params.id)
                .populate({
                path: 'wallet',
                populate: {
                    path: 'user',
                    select: 'name email role phoneNumber profileImage'
                }
            });
            if (!transaction) {
                throw new appError_1.default('Transaction not found', 404);
            }
            res.status(200).json({
                status: 'success',
                data: { transaction }
            });
        });
        /**
         * Update transaction status (Admin)
         */
        this.updateTransactionStatus = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { status } = req.body;
            if (!status) {
                throw new appError_1.default('Please provide a status', 400);
            }
            const transaction = await transaction_model_1.default.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
            if (!transaction) {
                throw new appError_1.default('Transaction not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: 'Transaction status updated successfully',
                data: { transaction }
            });
        });
        /**
         * Get single menu item by ID
         */
        this.getMenuItemById = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const menuItem = await foodItem_model_1.default.findById(req.params.id).populate('restaurant', 'name');
            if (!menuItem) {
                throw new appError_1.default('Menu item not found', 404);
            }
            res.status(200).json({
                status: 'success',
                data: { menuItem }
            });
        });
        /**
         * Create global menu item (Admin)
         */
        this.createMenuItem = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { name, description, price, category, restaurantId, isAvailable, isVegetarian, isSpicy, calories } = req.body;
            if (!name || !price || !category || !restaurantId) {
                throw new appError_1.default('Please provide name, price, category and restaurantId', 400);
            }
            // Resolve category (find or create if it's a name instead of ObjectId)
            let categoryId = category;
            if (!mongoose_1.default.Types.ObjectId.isValid(category)) {
                let existingCategory = await category_model_1.default.findOne({
                    name: { $regex: new RegExp(`^${category.trim()}$`, 'i') },
                    restaurant: restaurantId
                });
                if (!existingCategory) {
                    existingCategory = await category_model_1.default.create({
                        name: category.trim(),
                        restaurant: restaurantId,
                        order: 0
                    });
                }
                categoryId = existingCategory._id;
            }
            const menuItem = await foodItem_model_1.default.create({
                name,
                description: description || '',
                price: Number(price),
                category: categoryId,
                restaurant: restaurantId,
                isAvailable: isAvailable === 'true' || isAvailable === true,
                isVegetarian: isVegetarian === 'true' || isVegetarian === true,
                isSpicy: isSpicy === 'true' || isSpicy === true,
                calories: calories ? Number(calories) : undefined,
                image: req.file?.path
            });
            res.status(201).json({
                status: 'success',
                message: 'Menu item created successfully',
                data: { menuItem }
            });
        });
        /**
         * Update menu item (Admin)
         */
        this.updateMenuItem = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const menuItem = await foodItem_model_1.default.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
            if (!menuItem) {
                throw new appError_1.default('Menu item not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: 'Menu item updated successfully',
                data: { menuItem }
            });
        });
        /**
         * Delete menu item (Admin)
         */
        this.deleteMenuItem = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const menuItem = await foodItem_model_1.default.findByIdAndDelete(req.params.id);
            if (!menuItem) {
                throw new appError_1.default('Menu item not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: 'Menu item deleted successfully'
            });
        });
        /**
         * Get all promos/coupons (Admin)
         */
        this.getAllPromos = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const promos = await promo_model_1.default.find().populate('restaurant', 'name').sort({ createdAt: -1 });
            res.status(200).json({
                status: 'success',
                results: promos.length,
                data: { promos }
            });
        });
        /**
         * Create a promo/coupon code (Admin)
         */
        this.createPromo = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { code, discountPercentage, maxDiscountAmount, minOrderAmount, expiryDate, usageLimit, restaurantId } = req.body;
            if (!code || !discountPercentage || !expiryDate) {
                throw new appError_1.default('Please provide code, discountPercentage, and expiryDate', 400);
            }
            const promo = await promo_model_1.default.create({
                code: code.toUpperCase(),
                discountPercentage: Number(discountPercentage),
                maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : undefined,
                minOrderAmount: minOrderAmount ? Number(minOrderAmount) : 0,
                expiryDate: new Date(expiryDate),
                usageLimit: usageLimit ? Number(usageLimit) : undefined,
                restaurant: restaurantId || undefined
            });
            res.status(201).json({
                status: 'success',
                message: 'Promo/Coupon created successfully',
                data: { promo }
            });
        });
        /**
         * Toggle promo/coupon active status (Admin)
         */
        this.updatePromoStatus = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { isActive } = req.body;
            const promo = await promo_model_1.default.findByIdAndUpdate(req.params.id, { isActive }, { new: true, runValidators: true });
            if (!promo) {
                throw new appError_1.default('Promo not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: `Promo has been successfully ${isActive ? 'activated' : 'deactivated'}`,
                data: { promo }
            });
        });
        /**
         * Delete promo/coupon (Admin)
         */
        this.deletePromo = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const promo = await promo_model_1.default.findByIdAndDelete(req.params.id);
            if (!promo) {
                throw new appError_1.default('Promo not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: 'Promo permanently deleted successfully'
            });
        });
        /**
         * Get all broadcast notifications history
         */
        this.getAllNotifications = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const notifications = await notification_model_1.default.find().sort({ createdAt: -1 });
            res.status(200).json({
                status: 'success',
                results: notifications.length,
                data: { notifications }
            });
        });
        /**
         * Broadcast a notification to users of a specific role
         */
        this.broadcastNotification = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { title, body, channels, recipientType, targetRole, userIds } = req.body;
            if (!title || !body || !channels || !Array.isArray(channels) || !recipientType) {
                throw new appError_1.default('Please provide title, body, channels array, and recipientType', 400);
            }
            // Determine target users
            let query = {};
            if (recipientType === 'role' && targetRole && targetRole !== 'all') {
                query.role = targetRole;
            }
            else if (recipientType === 'selected' && Array.isArray(userIds) && userIds.length > 0) {
                query._id = { $in: userIds };
            }
            const targetUsers = await user_model_1.default.find(query);
            if (targetUsers.length === 0) {
                throw new appError_1.default('No target users found matching the criteria', 404);
            }
            // Send notifications concurrently
            const notificationPromises = targetUsers.map(async (user) => {
                const promises = [];
                // 1. Live Push Notifications (FCM / Socket.io)
                if (channels.includes('push')) {
                    promises.push(notification_service_1.default.sendNotification(user._id.toString(), title, body, { type: 'BROADCAST' })
                        .catch(err => logger_1.default.error(`Error sending push to ${user._id}:`, err)));
                }
                // 2. Email Broadcast
                if (channels.includes('email') && user.email) {
                    const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <h2 style="color: #0F3725; text-align: center;">${title}</h2>
            <p>Hello ${user.name},</p>
            <p style="line-height: 1.6; color: #374151;">${body}</p>
            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 20px 0;" />
            <p style="font-size: 11px; color: #6b7280; text-align: center;">
              This is a global broadcast announcement from GoEat Admin.
            </p>
          </div>
        `;
                    promises.push(email_util_1.default.sendEmail(user.email, title, emailHtml)
                        .catch(err => logger_1.default.error(`Error sending email to ${user.email}:`, err)));
                }
                // 3. SMS notification via Twilio
                if (channels.includes('sms') && user.phoneNumber) {
                    promises.push((0, sms_util_1.sendSMS)(user.phoneNumber, `${title}: ${body}`)
                        .catch(err => logger_1.default.error(`Error sending SMS to ${user.phoneNumber}:`, err)));
                }
                return Promise.all(promises);
            });
            await Promise.all(notificationPromises);
            // Save notification broadcast log to database
            const notification = await notification_model_1.default.create({
                title,
                body,
                targetRole: recipientType === 'role' ? targetRole : recipientType,
                sentCount: targetUsers.length
            });
            res.status(201).json({
                status: 'success',
                message: `Notification broadcasted successfully via [${channels.join(', ')}] to ${targetUsers.length} users.`,
                data: { notification }
            });
        });
        /**
         * Get all role permission configurations
         */
        this.getRolesPermissions = (0, catchAsync_1.catchAsync)(async (req, res) => {
            let roles = await role_model_1.default.find().sort({ roleName: 1 });
            if (roles.length === 0) {
                // Auto-seed default custom roles
                const defaultRoles = [
                    {
                        roleName: 'onboarder',
                        permissions: ['restaurants.onboard', 'restaurants.crud']
                    },
                    {
                        roleName: 'payouts',
                        permissions: ['payouts.manage', 'analytics.view']
                    },
                    {
                        roleName: 'support',
                        permissions: ['users.read', 'orders.read', 'orders.accept', 'orders.dispatch']
                    },
                    {
                        roleName: 'marketing',
                        permissions: ['promo.manage', 'notifications.broadcast']
                    }
                ];
                await role_model_1.default.insertMany(defaultRoles);
                roles = await role_model_1.default.find().sort({ roleName: 1 });
            }
            res.status(200).json({
                status: 'success',
                results: roles.length,
                data: { roles }
            });
        });
        /**
         * Update role permissions
         */
        this.updateRolePermissions = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { permissions } = req.body;
            if (!Array.isArray(permissions)) {
                throw new appError_1.default('Permissions must be an array of strings', 400);
            }
            const role = await role_model_1.default.findByIdAndUpdate(req.params.id, { permissions }, { new: true, runValidators: true });
            if (!role) {
                throw new appError_1.default('Role config not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: 'Role permissions updated successfully',
                data: { role }
            });
        });
        /**
         * Create a new role with permissions (Admin)
         */
        this.createRolePermissions = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { roleName, permissions } = req.body;
            if (!roleName) {
                throw new appError_1.default('Please specify roleName', 400);
            }
            const existingRole = await role_model_1.default.findOne({ roleName: roleName.toLowerCase() });
            if (existingRole) {
                throw new appError_1.default('Role already exists. Use the matrix checklist to update it.', 400);
            }
            const role = await role_model_1.default.create({
                roleName: roleName.toLowerCase(),
                permissions: permissions || []
            });
            res.status(201).json({
                status: 'success',
                message: 'New role created successfully',
                data: { role }
            });
        });
        /**
         * Delete a custom role configuration (Admin)
         */
        this.deleteRolePermissions = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const role = await role_model_1.default.findByIdAndDelete(req.params.id);
            if (!role) {
                throw new appError_1.default('Role config not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: 'Role deleted successfully'
            });
        });
        /**
         * Get single user details by ID (Admin)
         */
        this.getUserById = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const user = await user_model_1.default.findById(req.params.id);
            if (!user) {
                throw new appError_1.default('User not found', 404);
            }
            res.status(200).json({
                status: 'success',
                data: { user }
            });
        });
        /**
         * Create a new user (Admin)
         */
        this.createUser = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { name, email, phoneNumber, role, status, customRole } = req.body;
            if (!name || !email || !role) {
                throw new appError_1.default('Please specify name, email, and role', 400);
            }
            // Always generate a secure cryptographic random password for manually created users
            const randomHex = crypto_1.default.randomBytes(6).toString('hex').toUpperCase();
            const password = `GoEat#${randomHex}9!`;
            const user = await user_model_1.default.create({
                name,
                email: email.toLowerCase(),
                password,
                phoneNumber: phoneNumber || undefined,
                role,
                status: status || user_model_1.UserStatus.ACTIVE,
                customRole: role === 'admin' ? (customRole || 'super-admin') : undefined,
                isVerified: true
            });
            // Send credentials email to the manually created user
            try {
                await email_util_1.default.sendTemplateEmail(email.toLowerCase(), 'CREDENTIALS_ALERT', 'Your Go-Eat Account Access Credentials', {
                    name,
                    role,
                    customRole: role === 'admin' ? (customRole || 'super-admin') : undefined,
                    email: email.toLowerCase(),
                    password
                }, 'secure');
            }
            catch (mailErr) {
                console.error('Failed to send manually created user credentials email:', mailErr);
            }
            res.status(201).json({
                status: 'success',
                message: 'User created successfully',
                data: { user }
            });
        });
        /**
         * Update user details (Admin)
         */
        this.updateUser = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const updateData = { ...req.body };
            // Enforce Super Admin only for status updates (suspending / activating users)
            if (updateData.status && updateData.status !== undefined) {
                const isSuperAdmin = req.user && req.user.role === 'admin' && (!req.user.customRole || req.user.customRole === 'super-admin');
                if (!isSuperAdmin) {
                    throw new appError_1.default('Only Super Admins can suspend or activate users', 403);
                }
            }
            // Enforce Super Admin only for changing user roles or custom roles
            if ((updateData.role && updateData.role !== undefined) || (updateData.customRole && updateData.customRole !== undefined)) {
                const isSuperAdmin = req.user && req.user.role === 'admin' && (!req.user.customRole || req.user.customRole === 'super-admin');
                if (!isSuperAdmin) {
                    throw new appError_1.default('Only Super Admins can change user roles or permission scopes', 403);
                }
            }
            if (updateData.role && updateData.role !== 'admin') {
                updateData.customRole = undefined;
            }
            const user = await user_model_1.default.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
            if (!user) {
                throw new appError_1.default('User not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: 'User updated successfully',
                data: { user }
            });
        });
        /**
         * Get all referral details (Admin)
         */
        this.getAllReferrals = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const referredUsers = await user_model_1.default.find({ referredBy: { $exists: true, $ne: null } })
                .populate('referredBy', 'name email role referralCode')
                .sort({ createdAt: -1 });
            const topReferrers = await user_model_1.default.find({ referralCount: { $gt: 0 } })
                .sort({ referralCount: -1 })
                .limit(10);
            res.status(200).json({
                status: 'success',
                data: {
                    referredUsers,
                    topReferrers
                }
            });
        });
        /**
         * Delete user (Admin)
         */
        this.deleteUser = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const user = await user_model_1.default.findByIdAndDelete(req.params.id);
            if (!user) {
                throw new appError_1.default('User not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: 'User deleted successfully'
            });
        });
        /**
         * Get all customer reviews across the platform
         */
        this.getAllReviews = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { rating, restaurantId } = req.query;
            const filter = {};
            if (rating)
                filter.rating = Number(rating);
            if (restaurantId)
                filter.restaurant = restaurantId;
            const reviews = await review_model_1.default.find(filter)
                .populate('user', 'name email profileImage')
                .populate('restaurant', 'name')
                .populate('order', '_id totalAmount')
                .sort({ createdAt: -1 });
            res.status(200).json({
                status: 'success',
                results: reviews.length,
                data: { reviews }
            });
        });
        /**
         * Get a single review by ID
         */
        this.getReviewById = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const review = await review_model_1.default.findById(req.params.id)
                .populate('user', 'name email profileImage')
                .populate('restaurant', 'name address')
                .populate('order', '_id totalAmount createdAt');
            if (!review)
                throw new appError_1.default('Review not found', 404);
            res.status(200).json({
                status: 'success',
                data: { review }
            });
        });
        /**
         * Delete a review (Admin moderation)
         */
        this.deleteReview = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const review = await review_model_1.default.findByIdAndDelete(req.params.id);
            if (!review)
                throw new appError_1.default('Review not found', 404);
            res.status(200).json({
                status: 'success',
                message: 'Review removed successfully'
            });
        });
        /**
         * Get platform settings (singleton — auto-creates with defaults if not yet saved)
         */
        this.getSettings = (0, catchAsync_1.catchAsync)(async (req, res) => {
            let settings = await setting_model_1.default.findOne();
            if (!settings) {
                settings = await setting_model_1.default.create({});
            }
            res.status(200).json({
                status: 'success',
                data: { settings }
            });
        });
        /**
         * Update platform settings (upserts singleton)
         */
        this.updateSettings = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const allowed = [
                'appName', 'supportEmail', 'commissionRate', 'maxDeliveryDistance',
                'maintenanceMode', 'enableNotifications', 'minOrderAmount',
                'deliveryBaseFee', 'deliveryFeePerKm', 'defaultPaymentProvider',
                'countryPaymentProviders'
            ];
            const update = {};
            allowed.forEach(key => {
                if (req.body[key] !== undefined)
                    update[key] = req.body[key];
            });
            const settings = await setting_model_1.default.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true, runValidators: true });
            res.status(200).json({
                status: 'success',
                message: 'Platform settings updated successfully',
                data: { settings }
            });
        });
        /**
         * Update Top Spot status for a restaurant
         */
        this.updateTopSpot = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const { isTopSpot } = req.body;
            const restaurant = await restaurant_model_1.default.findById(id);
            if (!restaurant) {
                throw new appError_1.default('No restaurant found with that ID', 404);
            }
            restaurant.isTopSpot = isTopSpot;
            await restaurant.save();
            res.status(200).json({
                status: 'success',
                data: { restaurant },
            });
        });
        /**
         * Export platform data (orders, users, restaurants, transactions, menu-items, audit-logs, reviews, bookings, promos)
         * as CSV or JSON format.
         */
        this.exportData = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const rawEntity = (Array.isArray(req.params.entity) ? req.params.entity[0] : req.params.entity) ||
                (req.path.includes('/orders')
                    ? 'orders'
                    : req.path.includes('/users')
                        ? 'users'
                        : req.path.includes('/restaurants') || req.path.includes('/outlets')
                            ? 'restaurants'
                            : req.path.includes('/transactions') || req.path.includes('/payments')
                                ? 'transactions'
                                : req.path.includes('/menu-items')
                                    ? 'menu-items'
                                    : req.path.includes('/audit-logs')
                                        ? 'audit-logs'
                                        : req.path.includes('/reviews')
                                            ? 'reviews'
                                            : '');
            const entityStr = String(rawEntity || '').toLowerCase();
            const rawFormat = Array.isArray(req.query.format) ? req.query.format[0] : req.query.format;
            const formatStr = String(rawFormat || 'csv').toLowerCase();
            let records = [];
            let headers = [];
            let rows = [];
            switch (entityStr) {
                case 'orders': {
                    const orders = await order_model_1.default.find()
                        .populate('customer', 'name email phoneNumber')
                        .populate('restaurant', 'name address')
                        .populate('rider', 'name phoneNumber')
                        .sort({ createdAt: -1 })
                        .lean();
                    headers = [
                        'Order ID',
                        'Customer Name',
                        'Customer Email',
                        'Restaurant Name',
                        'Total Amount',
                        'Status',
                        'Payment Status',
                        'Created At',
                    ];
                    rows = orders.map((o) => [
                        o._id?.toString() || '',
                        o.customer?.name || 'N/A',
                        o.customer?.email || 'N/A',
                        o.restaurant?.name || 'N/A',
                        o.totalAmount || 0,
                        o.status || '',
                        o.paymentStatus || '',
                        o.createdAt ? new Date(o.createdAt).toISOString() : '',
                    ]);
                    records = orders;
                    break;
                }
                case 'users': {
                    const users = await user_model_1.default.find().sort({ createdAt: -1 }).lean();
                    headers = [
                        'User ID',
                        'Name',
                        'Email',
                        'Phone Number',
                        'Role',
                        'Status',
                        'Verification Status',
                        'Created At',
                    ];
                    rows = users.map((u) => [
                        u._id?.toString() || '',
                        u.name || '',
                        u.email || '',
                        u.phoneNumber || '',
                        u.role || '',
                        u.status || '',
                        u.verificationStatus || '',
                        u.createdAt ? new Date(u.createdAt).toISOString() : '',
                    ]);
                    records = users;
                    break;
                }
                case 'restaurants':
                case 'outlets': {
                    const restaurants = await restaurant_model_1.default.find()
                        .populate('owner', 'name email phoneNumber')
                        .sort({ createdAt: -1 })
                        .lean();
                    headers = [
                        'Restaurant ID',
                        'Name',
                        'Owner Name',
                        'Owner Email',
                        'Outlet Type',
                        'City',
                        'Phone',
                        'Status',
                        'Verification Status',
                        'Commission Rate',
                        'Rating',
                        'Created At',
                    ];
                    rows = restaurants.map((r) => [
                        r._id?.toString() || '',
                        r.name || '',
                        r.owner?.name || 'N/A',
                        r.owner?.email || 'N/A',
                        r.outletType || 'Restaurant',
                        r.location?.city || r.address || '',
                        r.phoneContact || '',
                        r.status || '',
                        r.verificationStatus || '',
                        r.commissionRate || 10,
                        r.rating || 0,
                        r.createdAt ? new Date(r.createdAt).toISOString() : '',
                    ]);
                    records = restaurants;
                    break;
                }
                case 'transactions':
                case 'payments': {
                    const transactions = await transaction_model_1.default.find()
                        .populate('user', 'name email')
                        .sort({ createdAt: -1 })
                        .lean();
                    headers = [
                        'Transaction ID',
                        'Reference',
                        'User Name',
                        'User Email',
                        'Amount',
                        'Type',
                        'Status',
                        'Payment Method',
                        'Created At',
                    ];
                    rows = transactions.map((t) => [
                        t._id?.toString() || '',
                        t.reference || '',
                        t.user?.name || 'N/A',
                        t.user?.email || 'N/A',
                        t.amount || 0,
                        t.type || '',
                        t.status || '',
                        t.paymentMethod || '',
                        t.createdAt ? new Date(t.createdAt).toISOString() : '',
                    ]);
                    records = transactions;
                    break;
                }
                case 'menu-items':
                case 'food-items': {
                    const items = await foodItem_model_1.default.find()
                        .populate('restaurant', 'name')
                        .populate('category', 'name')
                        .sort({ createdAt: -1 })
                        .lean();
                    headers = ['Item ID', 'Name', 'Restaurant', 'Category', 'Price', 'Is Available', 'Created At'];
                    rows = items.map((i) => [
                        i._id?.toString() || '',
                        i.name || '',
                        i.restaurant?.name || 'N/A',
                        i.category?.name || 'N/A',
                        i.price || 0,
                        i.isAvailable ? 'Yes' : 'No',
                        i.createdAt ? new Date(i.createdAt).toISOString() : '',
                    ]);
                    records = items;
                    break;
                }
                case 'audit-logs': {
                    const logs = await auditLog_model_1.default.find().sort({ createdAt: -1 }).lean();
                    headers = ['Log ID', 'Admin Email', 'Action', 'Resource', 'Resource ID', 'IP Address', 'Created At'];
                    rows = logs.map((l) => [
                        l._id?.toString() || '',
                        l.adminEmail || '',
                        l.action || '',
                        l.resource || '',
                        l.resourceId || '',
                        l.ipAddress || '',
                        l.createdAt ? new Date(l.createdAt).toISOString() : '',
                    ]);
                    records = logs;
                    break;
                }
                case 'reviews': {
                    const reviews = await review_model_1.default.find()
                        .populate('customer', 'name email')
                        .populate('restaurant', 'name')
                        .sort({ createdAt: -1 })
                        .lean();
                    headers = ['Review ID', 'Customer Name', 'Restaurant', 'Rating', 'Comment', 'Created At'];
                    rows = reviews.map((r) => [
                        r._id?.toString() || '',
                        r.customer?.name || 'N/A',
                        r.restaurant?.name || 'N/A',
                        r.rating || 0,
                        r.comment || '',
                        r.createdAt ? new Date(r.createdAt).toISOString() : '',
                    ]);
                    records = reviews;
                    break;
                }
                default:
                    throw new appError_1.default(`Unsupported export entity: ${entityStr}. Supported entities are: orders, users, restaurants, transactions, menu-items, audit-logs, reviews.`, 400);
            }
            if (formatStr === 'json') {
                return res.status(200).json({
                    status: 'success',
                    entity: entityStr,
                    count: records.length,
                    data: records,
                });
            }
            // CSV Format helper
            const escapeCsvCell = (cell) => {
                if (cell === null || cell === undefined)
                    return '';
                const str = String(cell);
                if (str.includes(',') ||
                    str.includes('"') ||
                    str.includes('\n') ||
                    str.includes('\r')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };
            const csvContent = [
                headers.map(escapeCsvCell).join(','),
                ...rows.map((row) => row.map(escapeCsvCell).join(',')),
            ].join('\n');
            const filename = `goeat_${entityStr}_export_${new Date()
                .toISOString()
                .slice(0, 10)}.csv`;
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.status(200).send(csvContent);
        });
    }
    /**
     * Helper to build Mongoose regional query filter based on admin token or ?country query param
     */
    getRegionFilter(req) {
        const queryCountry = req.query.country;
        const adminUser = req.user;
        const adminRegion = adminUser?.adminRegion || 'ALL';
        const targetCountry = adminRegion !== 'ALL'
            ? adminRegion
            : queryCountry && queryCountry !== 'ALL'
                ? queryCountry
                : null;
        if (!targetCountry)
            return {};
        if (targetCountry === 'Nigeria')
            return { isNigeria: true };
        if (targetCountry === 'Italy')
            return { isItaly: true };
        if (targetCountry === 'UK')
            return { isUk: true };
        return { country: targetCountry };
    }
}
exports.default = new AdminController();
