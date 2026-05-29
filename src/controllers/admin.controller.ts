import { Request, Response } from 'express';
import User, { UserRole, UserStatus } from '../models/user.model';
import Restaurant, { RestaurantStatus } from '../models/restaurant.model';
import Order, { OrderStatus } from '../models/order.model';
import Transaction from '../models/transaction.model';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';

class AdminController {
  /**
   * Get platform-wide statistics for the super-admin dashboard
   */
  public getPlatformStats = catchAsync(async (req: Request, res: Response) => {
    // User count breakdown
    const userStats = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // Order status breakdown
    const orderStats = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Financial summaries
    const financialStats = await Order.aggregate([
      { $match: { status: OrderStatus.DELIVERED } },
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

    const activeVendors = await Restaurant.countDocuments({ status: RestaurantStatus.ACTIVE });
    const pendingVendors = await Restaurant.countDocuments({ status: RestaurantStatus.PENDING });

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
  public getAllUsers = catchAsync(async (req: Request, res: Response) => {
    const { role, status } = req.query;
    const filter: any = {};

    if (role) filter.role = role;
    if (status) filter.status = status;

    const users = await User.find(filter).select('-password');

    res.status(200).json({
      status: 'success',
      results: users.length,
      data: { users }
    });
  });

  /**
   * Update any user's status (Suspend/Activate)
   */
  public updateUserStatus = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!Object.values(UserStatus).includes(status)) {
      throw new AppError('Invalid status value', 400);
    }

    const user = await User.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      throw new AppError('User not found', 404);
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
  public getAllRestaurants = catchAsync(async (req: Request, res: Response) => {
    const { status } = req.query;
    const filter: any = {};

    if (status) filter.status = status;

    const restaurants = await Restaurant.find(filter).populate('owner', 'name email phoneNumber');

    res.status(200).json({
      status: 'success',
      results: restaurants.length,
      data: { restaurants }
    });
  });

  /**
   * Approve or Suspend a restaurant (Critical for Marketplace Quality Control)
   */
  public updateRestaurantStatus = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!Object.values(RestaurantStatus).includes(status)) {
      throw new AppError('Invalid status value', 400);
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }

    res.status(200).json({
      status: 'success',
      message: `Restaurant status successfully updated to ${status}`,
      data: { restaurant }
    });
  });

  /**
   * Manually create a vendor user and their restaurant profile
   */
  public manuallyCreateRestaurant = catchAsync(async (req: Request, res: Response) => {
    const { 
      ownerName, 
      ownerEmail, 
      ownerPhone, 
      ownerPassword, 
      restaurantName, 
      description, 
      address, 
      location, 
      cuisine,
      openingHours 
    } = req.body;

    if (!ownerEmail || !ownerPassword || !restaurantName || !address) {
      throw new AppError('Please provide all required fields (ownerEmail, ownerPassword, restaurantName, address)', 400);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email: ownerEmail }, 
        ...(ownerPhone ? [{ phoneNumber: ownerPhone }] : [])
      ] 
    });
    
    if (existingUser) {
      throw new AppError('A user with this email or phone number already exists', 400);
    }

    // Create the vendor user
    const user = await User.create({
      name: ownerName,
      email: ownerEmail,
      phoneNumber: ownerPhone,
      password: ownerPassword,
      role: UserRole.VENDOR,
      status: UserStatus.ACTIVE,
      isVerified: true, // Auto-verified since created by admin
    });

    // Create the restaurant
    const restaurant = await Restaurant.create({
      owner: user._id,
      name: restaurantName,
      description: description || `Welcome to ${restaurantName}`,
      address,
      location: location || { type: 'Point', coordinates: [0, 0] }, // Default fallback coordinates
      cuisine: cuisine || [],
      openingHours: openingHours || { open: '08:00', close: '22:00' },
      status: RestaurantStatus.ACTIVE, // Auto-approved
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

export default new AdminController();
