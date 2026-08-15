import jwt, { SignOptions } from 'jsonwebtoken';
import User, { IUser, UserRole } from '../models/user.model';
import AppError from '../utils/appError';
import logger from '../utils/logger';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';

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

  public async login(identifier: string, password: string): Promise<{ user: IUser; token: string }> {
    if (!identifier || !password) {
      throw new AppError('Please provide email/phone and password', 400);
    }
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { phoneNumber: identifier }
      ]
    }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Incorrect email/phone or password', 401);
    }

    const token = this.signToken(user._id as unknown as string);

    user.password = undefined;

    logger.info(`👤 User logged in: ${user.phoneNumber || user.email}`);
    return { user, token };
  }

  public async socialLogin(type: 'google' | 'apple', token: string, role: UserRole = UserRole.CUSTOMER): Promise<{ user: IUser; token: string }> {
    let email: string;
    let socialId: string;
    let name: string;

    if (type === 'google') {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload) throw new AppError('Invalid Google token', 400);
      email = payload.email!;
      socialId = payload.sub;
      name = payload.name!;
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
      if (type === 'google' && !user.googleId) user.googleId = socialId;
      if (type === 'apple' && !user.appleId) user.appleId = socialId;
      await user.save();
    } else {
      user = await User.create({
        email,
        name,
        role,
        googleId: type === 'google' ? socialId : undefined,
        appleId: type === 'apple' ? socialId : undefined,
        isVerified: true,
      });
    }

    const jwtToken = this.signToken(user._id as unknown as string);
    return { user, token: jwtToken };
  }
}

export default new AuthService();
