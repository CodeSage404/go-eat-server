import { Request, Response } from 'express';
import User, { UserRole, UserStatus } from '../models/user.model';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import Restaurant from '../models/restaurant.model';
import { z } from 'zod';

const inviteStaffSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  customRole: z.string().min(2), // e.g., 'Head Chef', 'Cashier'
});

const updateStaffSchema = z.object({
  name: z.string().min(2).optional(),
  customRole: z.string().min(2).optional(),
  status: z.enum([UserStatus.ACTIVE, UserStatus.PENDING, UserStatus.SUSPENDED]).optional(),
});

class StaffController {
  /**
   * Invite/Create a new staff member for the vendor's restaurant
   */
  public inviteStaff = catchAsync(async (req: Request, res: Response) => {
    const vendor = req.user!;
    
    // Find vendor's restaurant
    const restaurant = await Restaurant.findOne({ owner: vendor._id });
    if (!restaurant) {
      throw new AppError('You must have a restaurant to add staff.', 400);
    }

    const validatedData = inviteStaffSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await User.findOne({ email: validatedData.email });
    if (existingUser) {
      throw new AppError('A user with this email already exists.', 400);
    }

    const newStaff = await User.create({
      name: validatedData.name,
      email: validatedData.email,
      password: validatedData.password,
      role: UserRole.STAFF,
      customRole: validatedData.customRole,
      restaurantId: restaurant._id,
      status: UserStatus.ACTIVE,
      isVerified: true, // We auto-verify them since they are created by the vendor
    });

    res.status(201).json({
      status: 'success',
      message: 'Staff member invited successfully',
      data: {
        staff: {
          id: newStaff._id,
          name: newStaff.name,
          email: newStaff.email,
          role: newStaff.role,
          customRole: newStaff.customRole,
          status: newStaff.status,
        },
      },
    });
  });

  /**
   * Get all staff members for the vendor's restaurant
   */
  public getStaff = catchAsync(async (req: Request, res: Response) => {
    const vendor = req.user!;
    
    const restaurant = await Restaurant.findOne({ owner: vendor._id });
    if (!restaurant) {
      throw new AppError('You must have a restaurant to view staff.', 400);
    }

    const staff = await User.find({
      restaurantId: restaurant._id,
      role: UserRole.STAFF,
    }).select('name email role customRole status profileImage createdAt');

    res.status(200).json({
      status: 'success',
      results: staff.length,
      data: {
        staff,
      },
    });
  });

  /**
   * Update a staff member's details
   */
  public updateStaff = catchAsync(async (req: Request, res: Response) => {
    const vendor = req.user!;
    const { id } = req.params;

    const restaurant = await Restaurant.findOne({ owner: vendor._id });
    if (!restaurant) throw new AppError('You must have a restaurant to update staff.', 400);

    const validatedData = updateStaffSchema.parse(req.body);

    const staffMember = await User.findOneAndUpdate(
      { _id: id, restaurantId: restaurant._id, role: UserRole.STAFF },
      validatedData,
      { new: true, runValidators: true }
    ).select('name email role customRole status profileImage');

    if (!staffMember) {
      throw new AppError('Staff member not found or does not belong to your restaurant', 404);
    }

    res.status(200).json({
      status: 'success',
      data: {
        staff: staffMember,
      },
    });
  });

  /**
   * Remove/Delete a staff member
   */
  public removeStaff = catchAsync(async (req: Request, res: Response) => {
    const vendor = req.user!;
    const { id } = req.params;

    const restaurant = await Restaurant.findOne({ owner: vendor._id });
    if (!restaurant) throw new AppError('You must have a restaurant to remove staff.', 400);

    const staffMember = await User.findOneAndDelete({
      _id: id,
      restaurantId: restaurant._id,
      role: UserRole.STAFF,
    });

    if (!staffMember) {
      throw new AppError('Staff member not found or does not belong to your restaurant', 404);
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  });
}

export default new StaffController();
