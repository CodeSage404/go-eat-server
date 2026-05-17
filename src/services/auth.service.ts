import jwt, { SignOptions } from 'jsonwebtoken';
import User, { IUser, UserRole } from '../models/user.model';
import AppError from '../utils/appError';
import logger from '../utils/logger';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

class AuthService {
  private signToken(id: string): string {
    const options: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN as any) || '90d',
    };

    return jwt.sign({ id }, process.env.JWT_SECRET!, options);
  }

  public async register(userData: Partial<IUser>): Promise<{ user: IUser; token: string }> {
    if (userData.phoneNumber) {
      const existingUser = await User.findOne({ phoneNumber: userData.phoneNumber });
      if (existingUser) {
        throw new AppError('Phone number already in use', 400);
      }
    }
    if (userData.email) {
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new AppError('Email already in use', 400);
      }
    }

    const user = await User.create(userData);
    const token = this.signToken(user._id as unknown as string);

    user.password = undefined;

    logger.info(`👤 New user registered: ${user.phoneNumber || user.email} as ${user.role}`);
    return { user, token };
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
      // Update social ID if not present
      if (type === 'google' && !user.googleId) user.googleId = socialId;
      if (type === 'apple' && !user.appleId) user.appleId = socialId;
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        email,
        name,
        role,
        googleId: type === 'google' ? socialId : undefined,
        appleId: type === 'apple' ? socialId : undefined,
        isVerified: true, // Social accounts are verified
      });
    }

    const jwtToken = this.signToken(user._id as unknown as string);
    return { user, token: jwtToken };
  }
}

export default new AuthService();
