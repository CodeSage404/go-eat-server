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
  private async initiateVerification(identifier: string, type: 'email' | 'phone'): Promise<{ channel: string; remaining: number }> {
    // Check and enforce OTP request rate limit (Max 6 attempts per identifier per 30 minutes)
    const { allowed, count, remaining } = await otpUtil.checkAndIncrementRequestLimit(identifier, 6, 1800);
    if (!allowed) {
      throw new AppError(
        'You have exceeded the maximum limit of 6 OTP requests for this account. Please wait 30 minutes before requesting another code or sign up using an alternative email address.',
        429
      );
    }

    if (type === 'email') {
      const otp = otpUtil.generateOTP();
      await otpUtil.storeOTP(identifier, otp);
      try {
        await emailUtil.sendOTP(identifier, otp);
        return { channel: 'email', remaining };
      } catch (err: any) {
        throw new AppError('Unable to send verification email. Please verify your email address or try again.', 400);
      }
    } else {
      const formattedPhone = identifier.startsWith('+') ? identifier : `+234${identifier.replace(/^0/, '')}`;
      const result = await startWhatsAppVerification(formattedPhone);
      return { channel: result.channel, remaining };
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
    let dispatchResult: { channel: string; remaining: number } | undefined;
    if (verifyByPhone) {
      dispatchResult = await this.initiateVerification(cleanData.phoneNumber!, 'phone');
    } else if (cleanData.email) {
      dispatchResult = await this.initiateVerification(cleanData.email, 'email');
    }

    const channelText = dispatchResult?.channel === 'whatsapp' 
      ? 'WhatsApp' 
      : (dispatchResult?.channel === 'sms' ? 'SMS' : (dispatchResult?.channel === 'email' ? 'email' : 'device'));

    res.status(200).json({
      status: 'success',
      message: `Signup details saved. A fresh verification code has been sent via ${channelText}.`,
      data: {
        channel: dispatchResult?.channel,
        remainingAttempts: dispatchResult?.remaining,
      },
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
    let dispatchResult: { channel: string; remaining: number } | undefined;
    if (verifyByPhone) {
      dispatchResult = await this.initiateVerification(cleanData.phoneNumber!, 'phone');
    } else if (cleanData.email) {
      dispatchResult = await this.initiateVerification(cleanData.email, 'email');
    }

    const channelText = dispatchResult?.channel === 'whatsapp' 
      ? 'WhatsApp' 
      : (dispatchResult?.channel === 'sms' ? 'SMS' : (dispatchResult?.channel === 'email' ? 'email' : 'device'));

    res.status(200).json({
      status: 'success',
      message: `Courier signup details saved. A fresh verification code has been sent via ${channelText}.`,
      data: {
        channel: dispatchResult?.channel,
        remainingAttempts: dispatchResult?.remaining,
      },
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
    let dispatchResult: { channel: string; remaining: number } | undefined;
    if (verifyByPhone) {
      dispatchResult = await this.initiateVerification(cleanData.phoneNumber!, 'phone');
    } else if (cleanData.email) {
      dispatchResult = await this.initiateVerification(cleanData.email, 'email');
    }

    const channelText = dispatchResult?.channel === 'whatsapp' 
      ? 'WhatsApp' 
      : (dispatchResult?.channel === 'sms' ? 'SMS' : (dispatchResult?.channel === 'email' ? 'email' : 'device'));

    res.status(200).json({
      status: 'success',
      message: `Vendor signup details saved. A fresh verification code has been sent via ${channelText}.`,
      data: {
        channel: dispatchResult?.channel,
        remainingAttempts: dispatchResult?.remaining,
      },
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

    // Reset OTP request rate limit upon successful verification
    await otpUtil.resetRequestLimit(identifier);

    let user;
    let token: string | undefined;

    // Check if there is a pending registration payload cached in Redis
    const pendingUserData = await otpUtil.getPendingUser(identifier);

    if (pendingUserData) {
      // NOW save the verified user document into MongoDB
      const result = await authService.createVerifiedUser(pendingUserData);
      user = result.user;
      token = result.token;
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
      token = authService.signToken(user._id as unknown as string);
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

    // Return success response with token and verified user
    res.status(200).json({
      status: 'success',
      token,
      data: { user },
      message: email 
        ? 'Email verified successfully.' 
        : 'Phone number verified successfully.',
    });
  });

  public resendOTP = catchAsync(async (req: Request, res: Response) => {
    const { email, phoneNumber } = req.body;
    const identifier = email || phoneNumber;

    if (!identifier) {
      throw new AppError('Please provide an email or phone number to resend OTP', 400);
    }

    let dispatchResult: { channel: string; remaining: number } | undefined;
    if (phoneNumber) {
      dispatchResult = await this.initiateVerification(phoneNumber, 'phone');
    } else if (email) {
      dispatchResult = await this.initiateVerification(email, 'email');
    }

    const channelText = dispatchResult?.channel === 'whatsapp' 
      ? 'WhatsApp' 
      : (dispatchResult?.channel === 'sms' ? 'SMS' : (dispatchResult?.channel === 'email' ? 'email' : 'device'));

    res.status(200).json({
      status: 'success',
      message: `A fresh verification code has been sent via ${channelText}. (${dispatchResult?.remaining || 0} resend attempts remaining).`,
      data: {
        channel: dispatchResult?.channel,
        remainingAttempts: dispatchResult?.remaining,
      },
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
    const allowedFields = ['name', 'phoneNumber', 'notificationsEnabled', 'profileImage'];
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
    user.hasChangedPassword = true;
    await user.save();

    const token = authService.signToken(user._id as unknown as string);

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully',
      token,
    });
  });

  public forgotPassword = catchAsync(async (req: Request, res: Response) => {
    const { email, phoneNumber } = req.body;
    const identifier = email || phoneNumber;

    if (!identifier) {
      throw new AppError('Please provide email or phone number', 400);
    }

    const query = email ? { email: email.toLowerCase() } : { phoneNumber };
    const user = await User.findOne(query);

    if (!user) {
      throw new AppError('No user found with that email or phone number', 404);
    }

    if (phoneNumber) {
      await this.initiateVerification(phoneNumber, 'phone');
    } else if (email) {
      await this.initiateVerification(email.toLowerCase(), 'email');
    }

    res.status(200).json({
      status: 'success',
      message: 'OTP sent successfully. Please check your messages.',
    });
  });

  public resetPassword = catchAsync(async (req: Request, res: Response) => {
    const { email, phoneNumber, otp, newPassword } = req.body;
    const identifier = email || phoneNumber;

    if (!identifier || !otp || !newPassword) {
      throw new AppError('Please provide identifier, otp, and newPassword', 400);
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

    const query = email ? { email: email.toLowerCase() } : { phoneNumber };
    const user = await User.findOne(query).select('+password');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password reset successful. You can now log in.',
    });
  });

  public updateUserLocation = catchAsync(async (req: Request, res: Response) => {
    const { address, coordinates, country, countryCode, isNigeria, isItaly, isUk } = req.body;
    const currentUser = (req as any).user;

    if (!address || !coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      throw new AppError('Address string and coordinates array [lng, lat] are required', 400);
    }

    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);

    let resolvedCountry = country;
    let resolvedCode = countryCode;
    if (!resolvedCountry) {
      const lowerAddr = address.toLowerCase();
      if (
        lowerAddr.includes('italy') ||
        lowerAddr.includes('italia') ||
        (lat >= 36.0 && lat <= 47.5 && lng >= 6.5 && lng <= 18.5)
      ) {
        resolvedCountry = 'Italy';
        resolvedCode = 'IT';
      } else if (
        lowerAddr.includes('united kingdom') ||
        lowerAddr.includes('uk') ||
        lowerAddr.includes('england') ||
        lowerAddr.includes('london') ||
        (lat >= 49.5 && lat <= 61.0 && lng >= -8.5 && lng <= 2.0)
      ) {
        resolvedCountry = 'UK';
        resolvedCode = 'UK';
      } else {
        resolvedCountry = 'Nigeria';
        resolvedCode = 'NG';
      }
    }

    const updatePayload: any = {
      location: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      country: resolvedCountry,
      countryCode: resolvedCode || 'NG',
      isNigeria: isNigeria !== undefined ? isNigeria : resolvedCountry === 'Nigeria',
      isItaly: isItaly !== undefined ? isItaly : resolvedCountry === 'Italy',
      isUk: isUk !== undefined ? isUk : resolvedCountry === 'UK',
    };

    const updatedUser = await User.findByIdAndUpdate(
      currentUser._id,
      updatePayload,
      { new: true }
    );

    logger.info(`📍 Location persisted to DB for user ${currentUser._id}: ${address} (${lng}, ${lat}) [Country: ${resolvedCountry}]`);

    res.status(200).json({
      status: 'success',
      message: 'User location saved to database successfully',
      data: { user: updatedUser },
    });
  });
}

export default new AuthController();
