import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser, UserRole, UserStatus } from '../models/user.model';
import RolePermission from '../models/role.model';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';

export interface AuthRequest extends Request {
  user?: IUser;
}

export const protect = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in! Please log in to get access.', 401));
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return next(new AppError('Server authentication configuration error.', 500));
  }

  const decoded: any = jwt.verify(token, jwtSecret);

  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  if (currentUser.status === 'suspended') {
    return next(new AppError('Your account has been suspended. Please contact support.', 403));
  }

  // Check if password was changed after token was issued
  if (currentUser.hasChangedPasswordAfter && currentUser.hasChangedPasswordAfter(decoded.iat)) {
    return next(new AppError('Password recently changed. Please log in again.', 401));
  }

  if (currentUser.role === 'vendor' && !currentUser.restaurantId) {
    const mongoose = require('mongoose');
    const Restaurant = mongoose.model('Restaurant');
    const restaurant = await Restaurant.findOne({ owner: currentUser._id });
    if (restaurant) {
      currentUser.restaurantId = restaurant._id;
      await currentUser.save({ validateBeforeSave: false });
    }
  }

  req.user = currentUser;
  next();
});

export const restrictTo = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user?.role as UserRole)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

export const checkPermission = (...permissions: string[]) => {
  return catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('You are not logged in!', 401));
    }

    // Super Admin has full unrestricted access
    if (req.user.role === UserRole.ADMIN && (!req.user.customRole || req.user.customRole === 'super-admin')) {
      return next();
    }

    // Check permissions defined for customRole
    if (req.user.customRole) {
      const rolePerm = await RolePermission.findOne({ roleName: req.user.customRole.toLowerCase() });
      if (rolePerm) {
        if (permissions.length === 0) return next();
        const hasAny = permissions.some(p => rolePerm.permissions.includes(p));
        if (hasAny) return next();
      }
    }

    return next(new AppError('You do not have permission to perform this action', 403));
  });
};
