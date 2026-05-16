import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser, UserRole } from '../models/user.model';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';

export interface AuthRequest extends Request {
  user?: IUser;
}

export const protect = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  // 1) Getting token and check if it's there
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in! Please log in to get access.', 401));
  }

  // Verification token
  const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

  // Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  // Check if user is suspended
  if (currentUser.status === 'suspended') {
    return next(new AppError('Your account has been suspended. Please contact support.', 403));
  }

  // GRANT ACCESS TO PROTECTED ROUTE
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
