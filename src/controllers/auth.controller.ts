import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import authService from '../services/auth.service';
import otpUtil from '../utils/otp.util';
import emailUtil from '../utils/email.util';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import User, { UserRole, UserStatus } from '../models/user.model';

// Validation Schemas
const userSignupSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phoneNumber: z.string().optional(),
});

const courierSignupSchema = userSignupSchema.extend({
  vehicleType: z.string().min(1, 'Vehicle type is required'),
  licenseNumber: z.string().min(1, 'License number is required'),
});

const vendorSignupSchema = userSignupSchema.extend({
  restaurantName: z.string().min(1, 'Restaurant name is required'),
  address: z.string().min(1, 'Address is required'),
  businessType: z.string().min(1, 'Business type is required'),
});

const verifyOTPSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

const socialLoginSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  role: z.nativeEnum(UserRole).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const updateMeSchema = z.object({
  name: z.string().optional(),
  phoneNumber: z.string().optional(),
  notificationsEnabled: z.boolean().optional(),
});

class AuthController {
  protect: any;
  private async initiateVerification(email: string) {
    const otp = otpUtil.generateOTP();
    await otpUtil.storeOTP(email, otp);
    await emailUtil.sendOTP(email, otp);
  }

  public signupUser = catchAsync(async (req: Request, res: Response) => {
    const validatedData = userSignupSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError(validatedData.error.issues.map(i => i.message).join(', '), 400);
    }

    const { user, token } = await authService.register({
      ...req.body,
      role: UserRole.CUSTOMER,
    });

    await this.initiateVerification(user.email);

    res.status(201).json({
      status: 'success',
      message: 'Signup successful. Please check your email for the OTP.',
      token,
      data: { user },
    });
  });

  public signupCourier = catchAsync(async (req: Request, res: Response) => {
    const validatedData = courierSignupSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError(validatedData.error.issues.map(i => i.message).join(', '), 400);
    }

    const { user, token } = await authService.register({
      ...req.body,
      role: UserRole.RIDER,
      status: UserStatus.PENDING, // Couriers need verification
    });

    await this.initiateVerification(user.email);

    res.status(201).json({
      status: 'success',
      message: 'Courier signup successful. Please verify your email.',
      token,
      data: { user },
    });
  });

  public signupVendor = catchAsync(async (req: Request, res: Response) => {
    const validatedData = vendorSignupSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError(validatedData.error.issues.map(i => i.message).join(', '), 400);
    }

    const { user, token } = await authService.register({
      ...req.body,
      role: UserRole.VENDOR,
      status: UserStatus.PENDING, // Vendors need verification
    });

    await this.initiateVerification(user.email);

    res.status(201).json({
      status: 'success',
      message: 'Vendor signup successful. Please verify your email.',
      token,
      data: { user },
    });
  });

  public verifyOTP = catchAsync(async (req: Request, res: Response) => {
    const validatedData = verifyOTPSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError('Invalid request details', 400);
    }

    const { email, otp } = req.body;
    const isValid = await otpUtil.verifyOTP(email, otp);

    if (!isValid) {
      throw new AppError('Invalid or expired OTP', 400);
    }

    // Update user verification status
    const user = await User.findOneAndUpdate(
      { email },
      { isVerified: true },
      { new: true }
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      status: 'success',
      message: 'Email verified successfully',
      data: { user },
    });
  });

  public login = catchAsync(async (req: Request, res: Response) => {
    const { user, token } = await authService.login(req.body.email, req.body.password);

    res.status(200).json({
      status: 'success',
      token,
      data: { user },
    });
  });

  public googleLogin = catchAsync(async (req: Request, res: Response) => {
    const validatedData = socialLoginSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError(validatedData.error.issues.map(i => i.message).join(', '), 400);
    }

    const { user, token } = await authService.socialLogin('google', req.body.token, req.body.role);

    res.status(200).json({
      status: 'success',
      token,
      data: { user },
    });
  });

  public appleLogin = catchAsync(async (req: Request, res: Response) => {
    const validatedData = socialLoginSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError(validatedData.error.issues.map(i => i.message).join(', '), 400);
    }

    const { user, token } = await authService.socialLogin('apple', req.body.token, req.body.role);

    res.status(200).json({
      status: 'success',
      token,
      data: { user },
    });
  });

  // User Profile Methods
  public getMe = catchAsync(async (req: Request, res: Response) => {
    // req.user is set by the protect middleware
    res.status(200).json({
      status: 'success',
      data: { user: req.user },
    });
  });

  public updateMe = catchAsync(async (req: Request, res: Response) => {
    const validatedData = updateMeSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError('Invalid update data', 400);
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user!._id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      status: 'success',
      data: { user: updatedUser },
    });
  });

  public changePassword = catchAsync(async (req: Request, res: Response) => {
    const validatedData = changePasswordSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError(validatedData.error.issues[0].message, 400);
    }

    const user = await User.findById(req.user!._id).select('+password');
    if (!user || !(await user.comparePassword(req.body.currentPassword))) {
      throw new AppError('Current password is incorrect', 401);
    }

    user.password = req.body.newPassword;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully',
    });
  });
}

export default new AuthController();
