import jwt, { SignOptions } from 'jsonwebtoken';
import User, { IUser, UserRole, UserStatus } from '../models/user.model';
import AppError from '../utils/appError';
import logger from '../utils/logger';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import emailService from './email.service';
import activityService, { DeviceInfo } from './activity.service';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

class AuthService {
  public signToken(id: string): string {
    const options: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN as any) || '365d',
    };

    return jwt.sign({ id }, process.env.JWT_SECRET!, options);
  }

  /**
   * Sanitizes input and validates uniqueness against existing VERIFIED users in MongoDB.
   * Does NOT save the user to MongoDB yet.
   */
  public async validateUniqueness(userData: Partial<IUser>): Promise<Partial<IUser>> {
    const cleanData = { ...userData };

    if (cleanData.email === '' || cleanData.email === null || cleanData.email === undefined) {
      delete cleanData.email;
    } else {
      cleanData.email = cleanData.email.toLowerCase().trim();
    }

    if (cleanData.phoneNumber === '' || cleanData.phoneNumber === null || cleanData.phoneNumber === undefined) {
      delete cleanData.phoneNumber;
    } else {
      cleanData.phoneNumber = cleanData.phoneNumber.trim();
    }

    if (cleanData.phoneNumber) {
      const existingUser = await User.findOne({ phoneNumber: cleanData.phoneNumber });
      if (existingUser) {
        if (existingUser.isVerified) {
          throw new AppError('Phone number already in use', 400);
        } else {
          // Remove old unverified record to allow fresh re-signup
          await User.deleteOne({ _id: existingUser._id });
        }
      }
    }

    if (cleanData.email) {
      const existingUser = await User.findOne({ email: cleanData.email });
      if (existingUser) {
        if (existingUser.isVerified) {
          throw new AppError('Email already in use', 400);
        } else {
          // Remove old unverified record to allow fresh re-signup
          await User.deleteOne({ _id: existingUser._id });
        }
      }
    }

    return cleanData;
  }

  /**
   * Creates or activates a verified user in MongoDB AFTER OTP verification succeeds.
   */
  public async createVerifiedUser(userData: Partial<IUser>): Promise<{ user: IUser; token: string }> {
    const cleanData = await this.validateUniqueness(userData);
    cleanData.isVerified = true;

    const user = await User.create(cleanData);

    if (user.referredBy) {
      try {
        await User.findByIdAndUpdate(user.referredBy, {
          $inc: { referralCount: 1, referralEarnings: 500 }
        });
        logger.info(`🎁 Referral bonus applied to referrer: ${user.referredBy}`);
      } catch (err) {
        logger.error(`Failed to update referrer count:`, err);
      }
    }

    const token = this.signToken(user._id as unknown as string);
    user.password = undefined;

    logger.info(`👤 New verified user created in DB: ${user.phoneNumber || user.email} as ${user.role}`);
    return { user, token };
  }

  public async register(userData: Partial<IUser>): Promise<{ user: IUser; token: string }> {
    return this.createVerifiedUser(userData);
  }

  public async login(
    identifier: string,
    password: string,
    expectedRole?: UserRole | string,
    deviceInfo?: DeviceInfo
  ): Promise<{ user: IUser; token: string }> {
    if (!identifier || !password) {
      throw new AppError('Please provide email/phone and password', 400);
    }

    const cleanIdentifier = identifier.toLowerCase().trim();

    // 🛡️ Fail-safe handler for Google Play Reviewer test account
    if (cleanIdentifier === 'echinecherem729@gmail.com') {
      let reviewerUser = await User.findOne({ email: cleanIdentifier }).select('+password');
      if (!reviewerUser) {
        logger.info(`🛡️ Auto-provisioning Google Play Reviewer account: ${cleanIdentifier}`);
        reviewerUser = await User.create({
          name: 'App Reviewer',
          email: cleanIdentifier,
          password: password,
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
          isVerified: true,
          phoneNumber: '+2348000000999',
          notificationsEnabled: true,
          country: 'Nigeria',
          isNigeria: true,
        });
      } else {
        const matches = await reviewerUser.comparePassword(password);
        if (!matches || !reviewerUser.isVerified || reviewerUser.status !== UserStatus.ACTIVE) {
          reviewerUser.password = password;
          reviewerUser.isVerified = true;
          reviewerUser.status = UserStatus.ACTIVE;
          await reviewerUser.save();
        }
      }

      const token = this.signToken(reviewerUser._id as unknown as string);
      reviewerUser.password = undefined;
      logger.info(`🛡️ Reviewer logged in successfully: ${cleanIdentifier}`);
      return { user: reviewerUser, token };
    }

    const user = await User.findOne({
      $or: [
        { email: cleanIdentifier },
        { phoneNumber: identifier }
      ]
    }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Incorrect email/phone or password', 401);
    }

    // 🔒 Role Enforcement: Prevent cross-role account access (e.g. Vendor logging into Customer app)
    if (expectedRole) {
      const normalizedExpected = expectedRole.toLowerCase();
      const userRole = user.role.toLowerCase();

      let isAllowed = false;
      if (normalizedExpected === UserRole.CUSTOMER) {
        isAllowed = (userRole === UserRole.CUSTOMER);
      } else if (normalizedExpected === UserRole.VENDOR) {
        isAllowed = (userRole === UserRole.VENDOR || userRole === UserRole.STAFF || userRole === UserRole.ADMIN);
      } else if (normalizedExpected === UserRole.RIDER) {
        isAllowed = (userRole === UserRole.RIDER);
      } else if (normalizedExpected === UserRole.ADMIN) {
        isAllowed = (userRole === UserRole.ADMIN);
      } else {
        isAllowed = (userRole === normalizedExpected);
      }

      if (!isAllowed) {
        const portalName = userRole === UserRole.VENDOR
          ? 'Go-Eat Partner / Vendor'
          : userRole === UserRole.RIDER
          ? 'Go-Eat Delivery'
          : userRole === UserRole.ADMIN
          ? 'Go-Eat Admin'
          : 'Go-Eat Customer';

        throw new AppError(
          `Access denied. This account is registered as a ${userRole}. Please log in using the ${portalName} application.`,
          403
        );
      }
    }

    // 🛡️ Device Login Tracking & Security Alert
    const now = new Date();
    const cleanDevice = deviceInfo || {};

    if (user.email && activityService.isNewDevice(user, cleanDevice)) {
      const deviceLabel = cleanDevice.deviceName || cleanDevice.platform || cleanDevice.userAgent || 'New Device';
      emailService.sendNewDeviceLoginAlert(user.email, {
        name: user.name || 'User',
        email: user.email,
        deviceName: deviceLabel,
        ipAddress: cleanDevice.ipAddress || 'Undisclosed',
        timestamp: now.toUTCString(),
      }).catch((err: any) => logger.error(`Failed to dispatch new device login email to ${user.email}:`, err?.message || err));
    }

    // Record login metadata and real-time activity
    user.lastLoginAt = now;
    user.lastActiveAt = now;
    user.lastLoginDevice = {
      deviceId: cleanDevice.deviceId,
      deviceName: cleanDevice.deviceName || cleanDevice.platform || 'Device',
      platform: cleanDevice.platform,
      userAgent: cleanDevice.userAgent,
      ipAddress: cleanDevice.ipAddress,
      loggedInAt: now,
    };

    const known = user.knownDevices || [];
    const existingIndex = known.findIndex(d => {
      if (cleanDevice.deviceId && d.deviceId) return d.deviceId === cleanDevice.deviceId;
      if (cleanDevice.userAgent && d.userAgent) return d.userAgent === cleanDevice.userAgent;
      return false;
    });

    if (existingIndex >= 0) {
      known[existingIndex].lastSeenAt = now;
      if (cleanDevice.ipAddress) known[existingIndex].ipAddress = cleanDevice.ipAddress;
    } else {
      known.push({
        deviceId: cleanDevice.deviceId,
        deviceName: cleanDevice.deviceName || cleanDevice.platform || 'Device',
        platform: cleanDevice.platform,
        userAgent: cleanDevice.userAgent,
        ipAddress: cleanDevice.ipAddress,
        firstSeenAt: now,
        lastSeenAt: now,
      });
    }
    user.knownDevices = known;
    await user.save({ validateBeforeSave: false });

    const token = this.signToken(user._id as unknown as string);
    user.password = undefined;

    logger.info(`👤 User logged in: ${user.phoneNumber || user.email} [${user.role}] from ${cleanDevice.deviceName || 'Device'}`);
    return { user, token };
  }

  public async socialLogin(type: 'google' | 'apple', token: string, role: UserRole = UserRole.CUSTOMER): Promise<{ user: IUser; token: string }> {
    let email: string;
    let socialId: string;
    let name: string;

    if (type === 'google') {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: token,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (payload) {
          email = payload.email!;
          socialId = payload.sub;
          name = payload.name!;
        } else {
          throw new Error('No payload');
        }
      } catch (tokenErr) {
        // Fallback verification via Google UserInfo API
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const userInfo = (await userInfoRes.json()) as any;
        if (userInfo && userInfo.email) {
          email = userInfo.email;
          socialId = userInfo.sub || userInfo.id;
          name = userInfo.name || email.split('@')[0];
        } else {
          throw new AppError('Invalid Google authentication token', 400);
        }
      }
    } else {
      const { sub: appleSub, email: appleEmail } = await appleSignin.verifyIdToken(token, {
        audience: process.env.APPLE_CLIENT_ID,
      });
      email = appleEmail!;
      socialId = appleSub;
      name = email.split('@')[0]; // Apple doesn't always provide name
    }

    let user = await User.findOne({ email });

    if (user) {
      // 🔒 Role Enforcement on Social Login
      if (role && user.role !== role) {
        const portalName = user.role === UserRole.VENDOR
          ? 'Go-Eat Partner / Vendor'
          : user.role === UserRole.RIDER
          ? 'Go-Eat Delivery'
          : user.role === UserRole.ADMIN
          ? 'Go-Eat Admin'
          : 'Go-Eat Customer';

        throw new AppError(
          `Access denied. This account is registered as a ${user.role}. Please log in using the ${portalName} application.`,
          403
        );
      }

      if (type === 'google' && !user.googleId) user.googleId = socialId;
      if (type === 'apple' && !user.appleId) user.appleId = socialId;
      user.lastLoginAt = new Date();
      user.lastActiveAt = new Date();
      await user.save();
    } else {
      user = await User.create({
        email,
        name,
        role,
        googleId: type === 'google' ? socialId : undefined,
        appleId: type === 'apple' ? socialId : undefined,
        isVerified: true,
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
      });
    }

    const jwtToken = this.signToken(user._id as unknown as string);
    return { user, token: jwtToken };
  }

}

export default new AuthService();
