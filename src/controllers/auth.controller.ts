import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import authService from '../services/auth.service';
import User, { UserRole, UserStatus } from '../models/user.model';
import otpUtil from '../utils/otp.util';
import emailUtil from '../services/email.service';
import logger from '../utils/logger';
import { startWhatsAppVerification, checkWhatsAppVerification, formatPhoneNumber } from '../utils/twilioVerify.util';

class AuthController {
  private async initiateVerification(
    email?: string,
    phoneNumber?: string
  ): Promise<{ channel: string; remaining: number }> {
    const primaryId = email || phoneNumber || '';
    if (!primaryId) {
      throw new AppError('Verification identifier missing', 400);
    }

    // Check and enforce OTP request rate limit (Max 6 attempts per identifier per 30 minutes)
    const { allowed, count, remaining } = await otpUtil.checkAndIncrementRequestLimit(primaryId, 6, 1800);
    if (!allowed) {
      throw new AppError(
        'You have exceeded the maximum limit of 6 OTP requests for this account. Please wait 30 minutes before requesting another code or sign up using an alternative email address.',
        429
      );
    }

    // 1. Generate ONE single, shared 6-digit OTP code
    const otp = otpUtil.generateOTP();

    const deliveredChannels: string[] = [];

    // 2. If email is provided, store in Redis and dispatch via Brevo/SMTP immediately
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      await otpUtil.storeOTP(cleanEmail, otp);
      try {
        await emailUtil.sendOTP(cleanEmail, otp);
        deliveredChannels.push('email');
        logger.info(`📧 Verification OTP (${otp}) dispatched via email to ${cleanEmail}`);
      } catch (err: any) {
        logger.warn(`⚠️ Failed to send verification email to ${cleanEmail}:`, err.message);
      }
    }

    // 3. If phone is provided, store across all phone formats in Redis and dispatch via Twilio (WhatsApp & SMS)
    if (phoneNumber) {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      try {
        const phoneResult = await startWhatsAppVerification(formattedPhone, otp);
        if (phoneResult.channel !== 'redis') {
          deliveredChannels.push(phoneResult.channel);
        }
      } catch (err: any) {
        logger.warn(`⚠️ Phone verification note for ${formattedPhone}:`, err.message);
      }
    }

    let channelText = 'email and phone';
    if (deliveredChannels.includes('email') && (deliveredChannels.includes('whatsapp') || deliveredChannels.includes('sms'))) {
      channelText = 'email and phone';
    } else if (deliveredChannels.includes('email')) {
      channelText = 'email';
    } else if (deliveredChannels.includes('whatsapp')) {
      channelText = 'WhatsApp';
    } else if (deliveredChannels.includes('sms')) {
      channelText = 'SMS';
    } else {
      channelText = email ? 'email' : 'phone';
    }

    return { channel: channelText, remaining };
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

    // Cache pending registration in Redis for 10 minutes (stored under raw identifier and all phone variations)
    await otpUtil.storePendingUser(identifier, cleanData, 600);
    if (cleanData.phoneNumber) {
      const e164 = formatPhoneNumber(cleanData.phoneNumber);
      const local = cleanData.phoneNumber.startsWith('+234')
        ? '0' + cleanData.phoneNumber.slice(4)
        : cleanData.phoneNumber;
      await otpUtil.storePendingUser(e164, cleanData, 600);
      await otpUtil.storePendingUser(local, cleanData, 600);
    }

    // Dispatch verification OTP via both email and phone
    const dispatchResult = await this.initiateVerification(cleanData.email, cleanData.phoneNumber);

    res.status(200).json({
      status: 'success',
      message: `Signup details saved. A fresh verification code has been sent via ${dispatchResult.channel}.`,
      data: {
        channel: dispatchResult.channel,
        remainingAttempts: dispatchResult.remaining,
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
    if (cleanData.phoneNumber) {
      const e164 = formatPhoneNumber(cleanData.phoneNumber);
      const local = cleanData.phoneNumber.startsWith('+234')
        ? '0' + cleanData.phoneNumber.slice(4)
        : cleanData.phoneNumber;
      await otpUtil.storePendingUser(e164, cleanData, 600);
      await otpUtil.storePendingUser(local, cleanData, 600);
    }

    const dispatchResult = await this.initiateVerification(cleanData.email, cleanData.phoneNumber);

    res.status(200).json({
      status: 'success',
      message: `Courier signup details saved. A fresh verification code has been sent via ${dispatchResult.channel}.`,
      data: {
        channel: dispatchResult.channel,
        remainingAttempts: dispatchResult.remaining,
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
    if (cleanData.phoneNumber) {
      const e164 = formatPhoneNumber(cleanData.phoneNumber);
      const local = cleanData.phoneNumber.startsWith('+234')
        ? '0' + cleanData.phoneNumber.slice(4)
        : cleanData.phoneNumber;
      await otpUtil.storePendingUser(e164, cleanData, 600);
      await otpUtil.storePendingUser(local, cleanData, 600);
    }

    const dispatchResult = await this.initiateVerification(cleanData.email, cleanData.phoneNumber);

    res.status(200).json({
      status: 'success',
      message: `Vendor signup details saved. A fresh verification code has been sent via ${dispatchResult.channel}.`,
      data: {
        channel: dispatchResult.channel,
        remainingAttempts: dispatchResult.remaining,
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

    // Check if there is a pending registration payload cached in Redis across all phone variations
    let pendingUserData = await otpUtil.getPendingUser(identifier);
    if (!pendingUserData && phoneNumber) {
      const e164 = formatPhoneNumber(phoneNumber);
      const local = phoneNumber.startsWith('+234') ? '0' + phoneNumber.slice(4) : phoneNumber;
      pendingUserData = (await otpUtil.getPendingUser(e164)) || (await otpUtil.getPendingUser(local));
    }

    if (pendingUserData) {
      // NOW save the verified user document into MongoDB
      const result = await authService.createVerifiedUser(pendingUserData);
      user = result.user;
      token = result.token;
      await otpUtil.deletePendingUser(identifier);
      if (phoneNumber) {
        await otpUtil.deletePendingUser(formatPhoneNumber(phoneNumber));
        const local = phoneNumber.startsWith('+234') ? '0' + phoneNumber.slice(4) : phoneNumber;
        await otpUtil.deletePendingUser(local);
      }
    } else {
      // Update existing DB user if already present
      const query = email
        ? { email: email.toLowerCase() }
        : {
            $or: [
              { phoneNumber },
              { phoneNumber: formatPhoneNumber(phoneNumber) },
              { phoneNumber: phoneNumber.startsWith('+234') ? '0' + phoneNumber.slice(4) : phoneNumber },
            ],
          };
      user = await User.findOneAndUpdate(
        query,
        { isVerified: true },
        { returnDocument: 'after' }
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

    const dispatchResult = await this.initiateVerification(email, phoneNumber);

    res.status(200).json({
      status: 'success',
      message: `A fresh verification code has been sent via ${dispatchResult.channel}. (${dispatchResult.remaining} resend attempts remaining).`,
      data: {
        channel: dispatchResult.channel,
        remainingAttempts: dispatchResult.remaining,
      },
    });
  });

  public login = catchAsync(async (req: Request, res: Response) => {
    const { email, phoneNumber, password, role, expectedRole, deviceId, deviceName, platform } = req.body;
    const identifier = email || phoneNumber;

    const userAgent = (req.headers['user-agent'] as string) || '';
    const rawIp = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || '';
    const ipAddress = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '';

    const deviceInfo = {
      deviceId: deviceId || (req.headers['x-device-id'] as string),
      deviceName: deviceName || (req.headers['x-device-name'] as string),
      platform: platform || (req.headers['x-platform'] as string),
      userAgent,
      ipAddress,
    };

    const targetRole = expectedRole || role || (req.headers['x-expected-role'] as string);

    const { user, token } = await authService.login(identifier, password, targetRole, deviceInfo);

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
    const { token, role, name } = req.body;
    if (!token) throw new AppError('Apple token is required', 400);

    const result = await authService.socialLogin('apple', token, role || UserRole.CUSTOMER, name);

    res.status(200).json({
      status: 'success',
      token: result.token,
      data: { user: result.user },
    });
  });

  public appleAuthStart = catchAsync(async (req: Request, res: Response) => {
    const role = (req.query.role as string) || UserRole.CUSTOMER;
    const clientRedirectUri = (req.query.redirect_uri as string) || (role === UserRole.VENDOR ? 'go-eat-partners://apple-auth' : 'go-eat://apple-auth');
    
    const clientId = process.env.APPLE_SERVICES_ID || process.env.APPLE_CLIENT_ID?.split(',')[0] || 'com.emmanuelnwafor.goeat';
    const serverCallbackUrl = `${process.env.RENDER_EXTERNAL_URL || 'https://go-eat-server-z96s.onrender.com'}/api/v1/auth/apple/callback`;
    
    const stateObj = { role, clientRedirectUri };
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64url');

    const appleAuthUrl = `https://appleid.apple.com/auth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(serverCallbackUrl)}&response_type=code%20id_token&scope=name%20email&response_mode=form_post&state=${encodeURIComponent(state)}`;

    res.redirect(appleAuthUrl);
  });

  public appleCallback = catchAsync(async (req: Request, res: Response) => {
    const payload = req.method === 'POST' ? req.body : req.query;
    const { id_token, user: userJson, state, error } = payload;

    let role = UserRole.CUSTOMER;
    let clientRedirectUri = 'go-eat://apple-auth';

    if (state) {
      try {
        const decodedState = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf8'));
        if (decodedState.role) role = decodedState.role;
        if (decodedState.clientRedirectUri) clientRedirectUri = decodedState.clientRedirectUri;
      } catch (e) {
        logger.warn('Failed to parse Apple state parameter:', e);
      }
    }

    if (error) {
      const errUrl = `${clientRedirectUri}?error=${encodeURIComponent(String(error))}`;
      return res.send(`<html><head><script>window.location.href = "${errUrl}";</script></head><body>Redirecting back to app...</body></html>`);
    }

    if (!id_token) {
      const noTokenUrl = `${clientRedirectUri}?error=${encodeURIComponent('No ID token returned by Apple')}`;
      return res.send(`<html><head><script>window.location.href = "${noTokenUrl}";</script></head><body>Redirecting back to app...</body></html>`);
    }

    let fullName: string | undefined = undefined;
    if (userJson) {
      try {
        const parsedUser = typeof userJson === 'string' ? JSON.parse(userJson) : userJson;
        if (parsedUser.name) {
          const { firstName, lastName } = parsedUser.name;
          fullName = `${firstName || ''} ${lastName || ''}`.trim() || undefined;
        }
      } catch {}
    }

    const result = await authService.socialLogin('apple', id_token, role, fullName);

    const targetUrl = `${clientRedirectUri}?token=${encodeURIComponent(result.token)}&user=${encodeURIComponent(JSON.stringify(result.user))}`;

    // Return an HTML auto-redirect so Android Chrome CustomTabs seamlessly passes control back to the deep link scheme
    res.send(`<!DOCTYPE html>
<html>
  <head>
    <title>Authenticating with Apple...</title>
    <script>
      window.location.href = "${targetUrl}";
      setTimeout(function() {
        window.location.href = "${targetUrl}";
      }, 400);
    </script>
  </head>
  <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0F3D26; color: white;">
    <div style="text-align: center; padding: 20px;">
      <h2>Authenticated Successfully</h2>
      <p>Returning you to Go-Eat...</p>
      <a href="${targetUrl}" style="color: #FFC529; text-decoration: underline; font-weight: bold; font-size: 16px;">Tap here if not redirected automatically</a>
    </div>
  </body>
</html>`);
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
      returnDocument: 'after',
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
      { returnDocument: 'after', runValidators: true }
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
      { returnDocument: 'after' }
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
