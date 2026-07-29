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

  const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  if (currentUser.status === 'suspended') {
    return next(new AppError('Your account has been suspended. Please contact support.', 403));
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

    if (req.user.role === UserRole.ADMIN && (!req.user.customRole || req.user.customRole === 'super-admin')) {
      return next();
    }

    if (req.user.role === UserRole.ADMIN && req.user.customRole) {
      const rolePerm = await RolePermission.findOne({ roleName: req.user.customRole });
      if (rolePerm) {
        const hasAny = permissions.some(p => rolePerm.permissions.includes(p));
        if (hasAny) return next();
      }
    }

    return next(new AppError('You do not have permission to perform this action', 403));
  });
};
