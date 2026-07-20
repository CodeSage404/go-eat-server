import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import authService from '../services/auth.service';
import User, { UserRole, UserStatus } from '../models/user.model';
import otpUtil from '../utils/otp.util';
import emailUtil from '../services/email.service';
import logger from '../utils/logger';
import { startWhatsAppVerification, checkWhatsAppVerification } from '../utils/twilioVerify.util';

class AuthController {
  private async initiateVerification(identifier: string, type: 'email' | 'phone') {
    if (type === 'email') {
      const otp = otpUtil.generateOTP();
      await otpUtil.storeOTP(identifier, otp);
      await emailUtil.sendOTP(identifier, otp);
    } else {
      const formattedPhone = identifier.startsWith('+') ? identifier : `+234${identifier.replace(/^0/, '')}`;
      await startWhatsAppVerification(formattedPhone);
    }
  }

  public signupUser = catchAsync(async (req: Request, res: Response) => {
    const { email, phoneNumber, password } = req.body;
    if (!password || (!email && !phoneNumber)) {
      throw new AppError('Please provide email or phone number along with password', 400);
    }

    let referredBy;
    if (req.body.referralCode) {
      const referrer = await User.findOne({ referralCode: req.body.referralCode.toUpperCase() });
      if (referrer) referredBy = referrer._id;
    }

    // Validate uniqueness against existing VERIFIED users (does NOT write to DB yet)
    const cleanData = await authService.validateUniqueness({
      ...req.body,
      role: UserRole.CUSTOMER,
      referredBy,
    });

    const identifier = cleanData.email || cleanData.phoneNumber;
    if (!identifier) {
      throw new AppError('Verification identifier missing', 400);
    }

    // Cache pending registration in Redis for 10 minutes
    await otpUtil.storePendingUser(identifier, cleanData, 600);

    // Send OTP (If email/phone sending fails, error is thrown BEFORE DB creation)
    const verifyByPhone = !!cleanData.phoneNumber;
    if (verifyByPhone) {
      await this.initiateVerification(cleanData.phoneNumber!, 'phone');
    } else if (cleanData.email) {
      await this.initiateVerification(cleanData.email, 'email');
    }

    res.status(200).json({
      status: 'success',
      message: verifyByPhone
        ? 'Signup payload saved. Please verify your phone number with the OTP code.'
        : 'Signup payload saved. Please verify your email with the OTP code.',
    });
  });

  public signupCourier = catchAsync(async (req: Request, res: Response) => {
    const { email, phoneNumber, password } = req.body;
    if (!password || (!email && !phoneNumber)) {
      throw new AppError('Please provide email or phone number along with password', 400);
    }

    let referredBy;
    if (req.body.referralCode) {
      const referrer = await User.findOne({ referralCode: req.body.referralCode.toUpperCase() });
      if (referrer) referredBy = referrer._id;
    }

    const cleanData = await authService.validateUniqueness({
      ...req.body,
      role: UserRole.RIDER,
      status: UserStatus.PENDING,
      referredBy,
    });

    const identifier = cleanData.email || cleanData.phoneNumber;
    if (!identifier) {
      throw new AppError('Verification identifier missing', 400);
    }

    await otpUtil.storePendingUser(identifier, cleanData, 600);

    const verifyByPhone = !!cleanData.phoneNumber;
    if (verifyByPhone) {
      await this.initiateVerification(cleanData.phoneNumber!, 'phone');
    } else if (cleanData.email) {
      await this.initiateVerification(cleanData.email, 'email');
    }

    res.status(200).json({
      status: 'success',
      message: verifyByPhone
        ? 'Courier signup payload saved. Please verify your phone number.'
        : 'Courier signup payload saved. Please verify your email.',
    });
  });

  public signupVendor = catchAsync(async (req: Request, res: Response) => {
    const { email, phoneNumber, password } = req.body;
    if (!password || (!email && !phoneNumber)) {
      throw new AppError('Please provide email or phone number along with password', 400);
    }

    let referredBy;
    if (req.body.referralCode) {
      const referrer = await User.findOne({ referralCode: req.body.referralCode.toUpperCase() });
      if (referrer) referredBy = referrer._id;
    }

    const cleanData = await authService.validateUniqueness({
      ...req.body,
      role: UserRole.VENDOR,
      status: UserStatus.PENDING,
      referredBy,
    });

    const identifier = cleanData.email || cleanData.phoneNumber;
    if (!identifier) {
      throw new AppError('Verification identifier missing', 400);
    }

    await otpUtil.storePendingUser(identifier, cleanData, 600);

    const verifyByPhone = !!cleanData.phoneNumber;
    if (verifyByPhone) {
      await this.initiateVerification(cleanData.phoneNumber!, 'phone');
    } else if (cleanData.email) {
      await this.initiateVerification(cleanData.email, 'email');
    }

    res.status(200).json({
      status: 'success',
      message: verifyByPhone
        ? 'Vendor signup payload saved. Please verify your phone number.'
        : 'Vendor signup payload saved. Please verify your email.',
    });
  });

  public verifyOTP = catchAsync(async (req: Request, res: Response) => {
    const { email, phoneNumber, otp } = req.body;
    const identifier = email || phoneNumber;

    if (!identifier || !otp) {
      throw new AppError('Please provide email or phone number and OTP code', 400);
    }

    let isValid = false;
    if (phoneNumber) {
      isValid = await checkWhatsAppVerification(phoneNumber, otp);
    } else if (email) {
      isValid = await otpUtil.verifyOTP(email.toLowerCase(), otp);
    }

    if (!isValid) {
      throw new AppError('Invalid or expired OTP code', 400);
    }

    let user;

    // Check if there is a pending registration payload cached in Redis
    const pendingUserData = await otpUtil.getPendingUser(identifier);

    if (pendingUserData) {
      // NOW save the verified user document into MongoDB
      const result = await authService.createVerifiedUser(pendingUserData);
      user = result.user;
      await otpUtil.deletePendingUser(identifier);
    } else {
      // Update existing DB user if already present
      const query = email ? { email: email.toLowerCase() } : { phoneNumber };
      user = await User.findOneAndUpdate(
        query,
        { isVerified: true },
        { new: true }
      );

      if (!user) {
        throw new AppError('User registration not found. Please sign up again.', 404);
      }
    }

    // Send welcome email if user has an email address
    if (user.email) {
      try {
        await emailUtil.sendTemplateEmail(
          user.email,
          'WELCOME_USER',
          'Welcome to Go-Eat!',
          { name: user.name || 'User' }
        );
      } catch (err: any) {
        logger.error(`Error sending welcome email to ${user.email}:`, err.message);
      }
    }

    // Return success message requiring user to log in to obtain a JWT token
    res.status(200).json({
      status: 'success',
      message: email 
        ? 'Email verified successfully. Please log in with your credentials to continue.' 
        : 'Phone number verified successfully. Please log in with your credentials to continue.',
    });
  });

  public resendOTP = catchAsync(async (req: Request, res: Response) => {
    const { email, phoneNumber } = req.body;
    const identifier = email || phoneNumber;

    if (!identifier) {
      throw new AppError('Please provide an email or phone number to resend OTP', 400);
    }

    if (phoneNumber) {
      await this.initiateVerification(phoneNumber, 'phone');
    } else if (email) {
      await this.initiateVerification(email, 'email');
    }

    res.status(200).json({
      status: 'success',
      message: phoneNumber 
        ? 'Verification OTP code resent successfully to your WhatsApp.'
        : 'Verification OTP code resent successfully to your email address.',
    });
  });

  public login = catchAsync(async (req: Request, res: Response) => {
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
    const { token, role } = req.body;
    if (!token) throw new AppError('Google token is required', 400);

    const result = await authService.socialLogin('google', token, role || UserRole.CUSTOMER);

    res.status(200).json({
      status: 'success',
      token: result.token,
      data: { user: result.user },
    });
  });

  public appleLogin = catchAsync(async (req: Request, res: Response) => {
    const { token, role } = req.body;
    if (!token) throw new AppError('Apple token is required', 400);

    const result = await authService.socialLogin('apple', token, role || UserRole.CUSTOMER);

    res.status(200).json({
      status: 'success',
      token: result.token,
      data: { user: result.user },
    });
  });

  public getMe = catchAsync(async (req: Request, res: Response) => {
    res.status(200).json({
      status: 'success',
      data: { user: (req as any).user },
    });
  });

  public updateMe = catchAsync(async (req: Request, res: Response) => {
    const allowedFields = ['name', 'phoneNumber', 'notificationsEnabled'];
    const filteredBody: Record<string, any> = {};

    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredBody[key] = req.body[key];
      }
    });

    const currentUser = (req as any).user;
    const updatedUser = await User.findByIdAndUpdate(currentUser._id, filteredBody, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      status: 'success',
      data: { user: updatedUser },
    });
  });

  public completeProfile = catchAsync(async (req: Request, res: Response) => {
    const { name, email } = req.body;
    const currentUser = (req as any).user;

    if (!name || !email) {
      throw new AppError('Please provide both full name and email', 400);
    }

    const lowerEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: lowerEmail, _id: { $ne: currentUser._id } });

    if (existingUser && existingUser.isVerified) {
      throw new AppError('Email is already registered by another account', 400);
    }

    const updatedUser = await User.findByIdAndUpdate(
      currentUser._id,
      { name: name.trim(), email: lowerEmail },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      throw new AppError('User profile update failed', 400);
    }

    const otp = otpUtil.generateOTP();
    await otpUtil.storeOTP(lowerEmail, otp);
    await emailUtil.sendOTP(lowerEmail, otp);

    res.status(200).json({
      status: 'success',
      message: 'Profile details saved. Verification OTP dispatched to email.',
      data: { user: updatedUser },
    });
  });

  public changePassword = catchAsync(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const currentUser = (req as any).user;

    if (!currentPassword || !newPassword) {
      throw new AppError('Please provide current password and new password', 400);
    }

    const user = await User.findById(currentUser._id).select('+password');
    if (!user || !(await user.comparePassword(currentPassword))) {
      throw new AppError('Current password is incorrect', 401);
    }

    user.password = newPassword;
    await user.save();

    const token = authService.signToken(user._id as unknown as string);

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully',
      token,
    });
  });
}

export default new AuthController();
