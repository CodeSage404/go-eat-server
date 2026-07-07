import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import User, { UserRole, UserStatus } from '../models/user.model';
import Restaurant, { RestaurantStatus } from '../models/restaurant.model';
import Order, { OrderStatus } from '../models/order.model';
import Transaction from '../models/transaction.model';
import FoodItem from '../models/foodItem.model';
import AuditLog from '../models/auditLog.model';
import SystemLog from '../models/systemLog.model';
import Booking from '../models/booking.model';
import Promo from '../models/promo.model';
import Notification from '../models/notification.model';
import RolePermission from '../models/role.model';
import notificationService from '../services/notification.service';
import emailUtil from '../utils/email.util';
import { sendSMS } from '../utils/sms.util';
import logger from '../utils/logger';
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
   * Get all orders with optional status filtering for platform auditing
   */
  public getAllOrders = catchAsync(async (req: Request, res: Response) => {
    const { status } = req.query;
    const filter: any = {};

    if (status) filter.status = status;

    const orders = await Order.find(filter)
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
   * Admin Login using environment credentials
   */
  public adminLogin = catchAsync(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Please provide email and password', 400);
    }

    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@goeat.com').toLowerCase();
    const adminPass = process.env.ADMIN_PASS || 'AdminPass123!';

    if (email.toLowerCase() !== adminEmail || password !== adminPass) {
      throw new AppError('Incorrect email or password', 401);
    }

    // Find or create admin user in DB to maintain integrity with authentication middleware
    let user = await User.findOne({ email: adminEmail }).select('+password');
    if (!user) {
      user = await User.create({
        name: 'Platform Admin',
        email: adminEmail,
        password: adminPass,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        isVerified: true,
      });
    } else {
      // Keep DB password in sync with process.env.ADMIN_PASS
      const isPasswordMatch = await user.comparePassword(adminPass);
      if (!isPasswordMatch) {
        user.password = adminPass;
        await user.save();
      }
    }

    // Sign JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET as string, {
      expiresIn: (process.env.JWT_EXPIRES_IN as any) || '90d',
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
  public adminResetPassword = catchAsync(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Please provide current password and new password', 400);
    }

    if (newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters long', 400);
    }

    const adminPass = process.env.ADMIN_PASS || 'AdminPass123!';

    if (currentPassword !== adminPass) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Update in-memory env variable
    process.env.ADMIN_PASS = newPassword;

    // Update .env file on disk
    try {
      const envPath = path.join(__dirname, '../../.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        // Match ADMIN_PASS=...
        const regex = /^ADMIN_PASS=.*$/m;
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `ADMIN_PASS=${newPassword}`);
        } else {
          // If not found, append it
          envContent += `\nADMIN_PASS=${newPassword}`;
        }
        
        fs.writeFileSync(envPath, envContent, 'utf8');
      }
    } catch (err) {
      console.error('Error updating .env file:', err);
    }

    // 3. Update database user password
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@goeat.com').toLowerCase();
    const user = await User.findOne({ email: adminEmail });
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
  public manuallyCreateRestaurant = catchAsync(async (req: Request, res: Response) => {
    const name = req.body.restaurantName || req.body.businessName || req.body['Business Name'] || req.body['businessName'];
    const email = req.body.ownerEmail || req.body.emailAddress || req.body.platformUsername || req.body['Email Address'] || req.body['Platform Username'] || req.body['emailAddress'] || req.body['platformUsername'];
    const password = req.body.ownerPassword || req.body.loginPassword || req.body['Login Password'] || req.body['loginPassword'];
    
    const oName = req.body.ownerName || req.body['Owner Name'] || req.body['ownerName'] || 'Manual Owner';
    const phone = req.body.ownerPhone || req.body.phoneContact || req.body['Phone Contact'] || req.body['phoneContact'];
    const description = req.body.description || `Welcome to ${name}`;
    
    if (!email || !password || !name) {
      throw new AppError('Please provide all required fields (email/username, password, and restaurant/business name)', 400);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email: email.toLowerCase() }, 
        ...(phone ? [{ phoneNumber: phone }] : [])
      ] 
    });
    
    if (existingUser) {
      throw new AppError('A user with this email or phone number already exists', 400);
    }

    // Create the vendor user
    const user = await User.create({
      name: oName,
      email: email.toLowerCase(),
      phoneNumber: phone || undefined,
      password: password,
      role: UserRole.VENDOR,
      status: UserStatus.ACTIVE,
      isVerified: true, 
    });

    // Extract cuisine from different possible types/fields
    const rawCuisine = req.body.cuisine || req.body.restaurantCategory || req.body['Restaurant Category'] || req.body['restaurantCategory'];
    let cuisineArray: string[] = [];
    if (Array.isArray(rawCuisine)) {
      cuisineArray = rawCuisine;
    } else if (typeof rawCuisine === 'string') {
      cuisineArray = rawCuisine.split(',').map((c: string) => c.trim()).filter(Boolean);
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
    const restaurant = await Restaurant.create({
      owner: user._id,
      name: name,
      description: description,
      address: finalAddress,
      location: finalLocation,
      cuisine: cuisineArray,
      openingHours: finalOpeningHours,
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

  /**
   * Get profile details of a single restaurant by ID
   */
  public getRestaurantById = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id).populate('owner', 'name email phoneNumber');

    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { restaurant }
    });
  });

  /**
   * Get historical and pending orders for a specific restaurant
   */
  public getRestaurantOrders = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const orders = await Order.find({ restaurant: id })
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
  public getAllMenuItems = catchAsync(async (req: Request, res: Response) => {
    const items = await FoodItem.find()
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
  public getOrderById = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const order = await Order.findById(id)
      .populate('customer', 'name email phoneNumber')
      .populate('restaurant', 'name address location phoneContact')
      .populate('rider', 'name phoneNumber');

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { order }
    });
  });

  /**
   * Get all platform audit logs
   */
  public getAuditLogs = catchAsync(async (req: Request, res: Response) => {
    const logs = await AuditLog.find().sort({ createdAt: -1 });
    res.status(200).json({
      status: 'success',
      results: logs.length,
      data: { logs }
    });
  });

  /**
   * Get all platform system logs
   */
  public getSystemLogs = catchAsync(async (req: Request, res: Response) => {
    const logs = await SystemLog.find().sort({ createdAt: -1 });
    res.status(200).json({
      status: 'success',
      results: logs.length,
      data: { logs }
    });
  });

  /**
   * Refresh admin JWT token
   */
  public refreshAdminToken = catchAsync(async (req: any, res: Response) => {
    const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET as string, {
      expiresIn: (process.env.JWT_EXPIRES_IN as any) || '90d',
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
  public getAllBookings = catchAsync(async (req: Request, res: Response) => {
    const bookings = await Booking.find()
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
  public getBookingById = catchAsync(async (req: Request, res: Response) => {
    const booking = await Booking.findById(req.params.id)
      .populate('customer', 'name email phoneNumber')
      .populate('restaurant', 'name address');

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { booking }
    });
  });

  /**
   * Update booking status
   */
  public updateBookingStatus = catchAsync(async (req: Request, res: Response) => {
    const { status } = req.body;
    if (!['confirmed', 'cancelled'].includes(status)) {
      throw new AppError('Invalid booking status', 400);
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!booking) {
      throw new AppError('Booking not found', 404);
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
  public getAllTransactions = catchAsync(async (req: Request, res: Response) => {
    const transactions = await Transaction.find()
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
  public getTransactionById = catchAsync(async (req: Request, res: Response) => {
    const transaction = await Transaction.findById(req.params.id)
      .populate({
        path: 'wallet',
        populate: {
          path: 'user',
          select: 'name email role phoneNumber profileImage'
        }
      });

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { transaction }
    });
  });

  /**
   * Update transaction status (Admin)
   */
  public updateTransactionStatus = catchAsync(async (req: Request, res: Response) => {
    const { status } = req.body;
    if (!status) {
      throw new AppError('Please provide a status', 400);
    }

    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
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
  public getMenuItemById = catchAsync(async (req: Request, res: Response) => {
    const menuItem = await FoodItem.findById(req.params.id).populate('restaurant', 'name');
    if (!menuItem) {
      throw new AppError('Menu item not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { menuItem }
    });
  });

  /**
   * Create global menu item (Admin)
   */
  public createMenuItem = catchAsync(async (req: Request, res: Response) => {
    const { name, description, price, category, restaurantId, isAvailable, isVegetarian, isSpicy, calories } = req.body;
    
    if (!name || !price || !category || !restaurantId) {
      throw new AppError('Please provide name, price, category and restaurantId', 400);
    }

    const menuItem = await FoodItem.create({
      name,
      description: description || '',
      price: Number(price),
      category,
      restaurant: restaurantId,
      isAvailable: isAvailable ?? true,
      isVegetarian: isVegetarian ?? false,
      isSpicy: isSpicy ?? false,
      calories: calories ? Number(calories) : undefined
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
  public updateMenuItem = catchAsync(async (req: Request, res: Response) => {
    const menuItem = await FoodItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!menuItem) {
      throw new AppError('Menu item not found', 404);
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
  public deleteMenuItem = catchAsync(async (req: Request, res: Response) => {
    const menuItem = await FoodItem.findByIdAndDelete(req.params.id);
    if (!menuItem) {
      throw new AppError('Menu item not found', 404);
    }

    res.status(200).json({
      status: 'success',
      message: 'Menu item deleted successfully'
    });
  });

  /**
   * Get all promos/coupons (Admin)
   */
  public getAllPromos = catchAsync(async (req: Request, res: Response) => {
    const promos = await Promo.find().populate('restaurant', 'name').sort({ createdAt: -1 });
    res.status(200).json({
      status: 'success',
      results: promos.length,
      data: { promos }
    });
  });

  /**
   * Create a promo/coupon code (Admin)
   */
  public createPromo = catchAsync(async (req: Request, res: Response) => {
    const { code, discountPercentage, maxDiscountAmount, minOrderAmount, expiryDate, usageLimit, restaurantId } = req.body;
    
    if (!code || !discountPercentage || !expiryDate) {
      throw new AppError('Please provide code, discountPercentage, and expiryDate', 400);
    }

    const promo = await Promo.create({
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
  public updatePromoStatus = catchAsync(async (req: Request, res: Response) => {
    const { isActive } = req.body;
    const promo = await Promo.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true, runValidators: true }
    );

    if (!promo) {
      throw new AppError('Promo not found', 404);
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
  public deletePromo = catchAsync(async (req: Request, res: Response) => {
    const promo = await Promo.findByIdAndDelete(req.params.id);
    if (!promo) {
      throw new AppError('Promo not found', 404);
    }

    res.status(200).json({
      status: 'success',
      message: 'Promo permanently deleted successfully'
    });
  });

  /**
   * Get all broadcast notifications history
   */
  public getAllNotifications = catchAsync(async (req: Request, res: Response) => {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    res.status(200).json({
      status: 'success',
      results: notifications.length,
      data: { notifications }
    });
  });

  /**
   * Broadcast a notification to users of a specific role
   */
  public broadcastNotification = catchAsync(async (req: Request, res: Response) => {
    const { title, body, channels, recipientType, targetRole, userIds } = req.body;
    
    if (!title || !body || !channels || !Array.isArray(channels) || !recipientType) {
      throw new AppError('Please provide title, body, channels array, and recipientType', 400);
    }

    // Determine target users
    let query: any = {};
    if (recipientType === 'role' && targetRole && targetRole !== 'all') {
      query.role = targetRole;
    } else if (recipientType === 'selected' && Array.isArray(userIds) && userIds.length > 0) {
      query._id = { $in: userIds };
    }

    const targetUsers = await User.find(query);

    if (targetUsers.length === 0) {
      throw new AppError('No target users found matching the criteria', 404);
    }

    // Send notifications concurrently
    const notificationPromises = targetUsers.map(async (user) => {
      const promises: Promise<any>[] = [];

      // 1. Live Push Notifications (FCM / Socket.io)
      if (channels.includes('push')) {
        promises.push(
          notificationService.sendNotification(user._id.toString(), title, body, { type: 'BROADCAST' })
            .catch(err => logger.error(`Error sending push to ${user._id}:`, err))
        );
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
        promises.push(
          emailUtil.sendEmail(user.email, title, emailHtml)
            .catch(err => logger.error(`Error sending email to ${user.email}:`, err))
        );
      }

      // 3. SMS notification via Twilio
      if (channels.includes('sms') && user.phoneNumber) {
        promises.push(
          sendSMS(user.phoneNumber, `${title}: ${body}`)
            .catch(err => logger.error(`Error sending SMS to ${user.phoneNumber}:`, err))
        );
      }

      return Promise.all(promises);
    });

    await Promise.all(notificationPromises);

    // Save notification broadcast log to database
    const notification = await Notification.create({
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
  public getRolesPermissions = catchAsync(async (req: Request, res: Response) => {
    const roles = await RolePermission.find().sort({ roleName: 1 });
    res.status(200).json({
      status: 'success',
      results: roles.length,
      data: { roles }
    });
  });

  /**
   * Update role permissions
   */
  public updateRolePermissions = catchAsync(async (req: Request, res: Response) => {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      throw new AppError('Permissions must be an array of strings', 400);
    }

    const role = await RolePermission.findByIdAndUpdate(
      req.params.id,
      { permissions },
      { new: true, runValidators: true }
    );

    if (!role) {
      throw new AppError('Role config not found', 404);
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
  public createRolePermissions = catchAsync(async (req: Request, res: Response) => {
    const { roleName, permissions } = req.body;
    if (!roleName) {
      throw new AppError('Please specify roleName', 400);
    }

    const existingRole = await RolePermission.findOne({ roleName: roleName.toLowerCase() });
    if (existingRole) {
      throw new AppError('Role already exists. Use the matrix checklist to update it.', 400);
    }

    const role = await RolePermission.create({
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
   * Get single user details by ID (Admin)
   */
  public getUserById = catchAsync(async (req: Request, res: Response) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { user }
    });
  });

  /**
   * Create a new user (Admin)
   */
  public createUser = catchAsync(async (req: Request, res: Response) => {
    const { name, email, password, phoneNumber, role, status } = req.body;
    if (!name || !email || !password || !role) {
      throw new AppError('Please specify name, email, password, and role', 400);
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phoneNumber: phoneNumber || undefined,
      role,
      status: status || UserStatus.ACTIVE,
      isVerified: true
    });

    res.status(201).json({
      status: 'success',
      message: 'User created successfully',
      data: { user }
    });
  });

  /**
   * Update user details (Admin)
   */
  public updateUser = catchAsync(async (req: Request, res: Response) => {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new AppError('User not found', 404);
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
  public getAllReferrals = catchAsync(async (req: Request, res: Response) => {
    const referredUsers = await User.find({ referredBy: { $exists: true, $ne: null } })
      .populate('referredBy', 'name email role referralCode')
      .sort({ createdAt: -1 });

    const topReferrers = await User.find({ referralCount: { $gt: 0 } })
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
  public deleteUser = catchAsync(async (req: Request, res: Response) => {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      status: 'success',
      message: 'User deleted successfully'
    });
  });
}

export default new AdminController();
