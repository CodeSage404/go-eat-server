import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import authService from '../services/auth.service';
import otpUtil from '../utils/otp.util';
import emailUtil from '../utils/email.util';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import User, { UserRole, UserStatus } from '../models/user.model';
import logger from '../utils/logger';
import { sendWhatsApp } from '../utils/whatsapp.util';
import { startWhatsAppVerification, checkWhatsAppVerification } from '../utils/twilioVerify.util';
import notificationService from '../services/notification.service';

// Validation Schemas
const baseUserSignupSchema = z.object({
  phoneNumber: z.string().min(8, 'Phone number must be at least 8 digits').max(11, 'Phone number must be at most 11 digits').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
  email: z.string().email('Invalid email address').optional(),
  referralCode: z.string().optional(),
});

const userSignupSchema = baseUserSignupSchema.refine(
  (data) => data.phoneNumber || data.email,
  {
    message: 'Either phone number or email is required',
    path: ['phoneNumber', 'email'],
  }
);

const courierSignupSchema = baseUserSignupSchema.extend({
  vehicleType: z.string().min(1, 'Vehicle type is required'),
  licenseNumber: z.string().min(1, 'License number is required'),
}).refine(
  (data) => data.phoneNumber || data.email,
  {
    message: 'Either phone number or email is required',
    path: ['phoneNumber', 'email'],
  }
);

const vendorSignupSchema = baseUserSignupSchema.extend({
  restaurantName: z.string().min(1, 'Restaurant name is required'),
  address: z.string().min(1, 'Address is required'),
  businessType: z.string().min(1, 'Business type is required'),
}).refine(
  (data) => data.phoneNumber || data.email,
  {
    message: 'Either phone number or email is required',
    path: ['phoneNumber', 'email'],
  }
);

const verifyOTPSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  phoneNumber: z.string().optional(),
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

  private async initiateVerification(identifier: string, type: 'email' | 'phone') {
    if (type === 'email') {
      const otp = otpUtil.generateOTP();
      await otpUtil.storeOTP(identifier, otp);
      await emailUtil.sendOTP(identifier, otp);
    } else {
      // Send real WhatsApp OTP via Twilio Verify API v2
      await startWhatsAppVerification(identifier);

      // Also send via Push Notification if FCM is available on device
      try {
        const user = await User.findOne({ phoneNumber: identifier });
        if (user && user.fcmToken) {
          await notificationService.sendNotification(
            user._id.toString(),
            'Phone Verification OTP 🔑',
            'Your verification code has been sent to your WhatsApp.'
          );
        }
      } catch (err) {
        logger.error('Failed to dispatch OTP via push notification:', err);
      }
    }
  }

  public signupUser = catchAsync(async (req: Request, res: Response) => {
    const validatedData = userSignupSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError(validatedData.error.issues.map(i => i.message).join(', '), 400);
    }

    let referredBy;
    if (req.body.referralCode) {
      const referrer = await User.findOne({ referralCode: req.body.referralCode.toUpperCase() });
      if (referrer) referredBy = referrer._id;
    }

    const { user, token } = await authService.register({
      ...req.body,
      role: UserRole.CUSTOMER,
      referredBy,
    });

    const verifyByPhone = !!user.phoneNumber;
    if (verifyByPhone) {
      await this.initiateVerification(user.phoneNumber!, 'phone');
    } else if (user.email) {
      await this.initiateVerification(user.email, 'email');
    } else {
      throw new AppError('Verification identifier missing', 400);
    }

    res.status(201).json({
      status: 'success',
      message: verifyByPhone
        ? 'Signup successful. Please verify your phone number with the OTP.'
        : 'Signup successful. Please verify your email with the OTP.',
      token,
      data: { user },
    });
  });

  public signupCourier = catchAsync(async (req: Request, res: Response) => {
    const validatedData = courierSignupSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError(validatedData.error.issues.map(i => i.message).join(', '), 400);
    }

    let referredBy;
    if (req.body.referralCode) {
      const referrer = await User.findOne({ referralCode: req.body.referralCode.toUpperCase() });
      if (referrer) referredBy = referrer._id;
    }

    const { user, token } = await authService.register({
      ...req.body,
      role: UserRole.RIDER,
      status: UserStatus.PENDING, // Couriers need verification
      referredBy,
    });

    const verifyByPhone = !!user.phoneNumber;
    if (verifyByPhone) {
      await this.initiateVerification(user.phoneNumber!, 'phone');
    } else if (user.email) {
      await this.initiateVerification(user.email, 'email');
    } else {
      throw new AppError('Verification identifier missing', 400);
    }

    res.status(201).json({
      status: 'success',
      message: verifyByPhone
        ? 'Courier signup successful. Please verify your phone number.'
        : 'Courier signup successful. Please verify your email.',
      token,
      data: { user },
    });
  });

  public signupVendor = catchAsync(async (req: Request, res: Response) => {
    const validatedData = vendorSignupSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError(validatedData.error.issues.map(i => i.message).join(', '), 400);
    }

    let referredBy;
    if (req.body.referralCode) {
      const referrer = await User.findOne({ referralCode: req.body.referralCode.toUpperCase() });
      if (referrer) referredBy = referrer._id;
    }

    const { user, token } = await authService.register({
      ...req.body,
      role: UserRole.VENDOR,
      status: UserStatus.PENDING, // Vendors need verification
      referredBy,
    });

    const verifyByPhone = !!user.phoneNumber;
    if (verifyByPhone) {
      await this.initiateVerification(user.phoneNumber!, 'phone');
    } else if (user.email) {
      await this.initiateVerification(user.email, 'email');
    } else {
      throw new AppError('Verification identifier missing', 400);
    }

    res.status(201).json({
      status: 'success',
      message: verifyByPhone
        ? 'Vendor signup successful. Please verify your phone number.'
        : 'Vendor signup successful. Please verify your email.',
      token,
      data: { user },
    });
  });

  public verifyOTP = catchAsync(async (req: Request, res: Response) => {
    const validatedData = verifyOTPSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError('Invalid request details', 400);
    }

    const { email, phoneNumber, otp } = req.body;
    const identifier = email || phoneNumber;

    if (!identifier) {
      throw new AppError('Please provide email or phone number', 400);
    }

    let isValid = false;
    if (phoneNumber) {
      isValid = await checkWhatsAppVerification(phoneNumber, otp);
    } else if (email) {
      isValid = await otpUtil.verifyOTP(email.toLowerCase(), otp);
    }

    if (!isValid) {
      throw new AppError('Invalid or expired OTP', 400);
    }

    // Update user verification status based on query
    const query = email ? { email: email.toLowerCase() } : { phoneNumber };
    const user = await User.findOneAndUpdate(
      query,
      { isVerified: true },
      { new: true }
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      status: 'success',
      message: email ? 'Email verified successfully' : 'Phone number verified successfully',
      data: { user },
    });
  });

  public login = catchAsync(async (req: Request, res: Response) => {
    // Allows either email or phone login
    const { email, phoneNumber, password } = req.body;
    const identifier = email || phoneNumber;

    const { user, token } = await authService.login(identifier, password);

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

  /**
   * Complete user profile: Add name, add email, and trigger verification OTP for the new email
   */
  public completeProfile = catchAsync(async (req: Request, res: Response) => {
    const { name, email } = req.body;
    const user = await User.findById(req.user!._id);
    if (!user) throw new AppError('User not found', 404);

    if (name) user.name = name;

    if (email && email.toLowerCase() !== user.email) {
      // Check if this email is already registered by someone else
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        throw new AppError('Email is already registered by another user', 400);
      }
      user.email = email.toLowerCase();
      // Trigger email verification
      await this.initiateVerification(user.email, 'email');
    }

    await user.save();

    res.status(200).json({
      status: 'success',
      message: email ? 'Profile updated. Please verify the new email with the OTP sent.' : 'Profile completed successfully.',
      data: { user },
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
