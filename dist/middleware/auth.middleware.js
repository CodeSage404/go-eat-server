"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPermission = exports.restrictTo = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importStar(require("../models/user.model"));
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
const role_model_1 = __importDefault(require("../models/role.model"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
exports.protect = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        return next(new appError_1.default('You are not logged in! Please log in to get access.', 401));
    }
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        return next(new appError_1.default('Server authentication configuration error.', 500));
    }
    const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
    const currentUser = await user_model_1.default.findById(decoded.id);
    if (!currentUser) {
        return next(new appError_1.default('The user belonging to this token no longer exists.', 401));
    }
    if (currentUser.status === 'suspended') {
        return next(new appError_1.default('Your account has been suspended. Please contact support.', 403));
    }
    // Check if password was changed after token was issued
    if (currentUser.hasChangedPasswordAfter && currentUser.hasChangedPasswordAfter(decoded.iat)) {
        return next(new appError_1.default('Password recently changed. Please log in again.', 401));
    }
    if (currentUser.role === 'vendor' && !currentUser.restaurantId) {
        const restaurant = await restaurant_model_1.default.findOne({ owner: currentUser._id });
        if (restaurant) {
            currentUser.restaurantId = restaurant._id;
            await currentUser.save({ validateBeforeSave: false });
        }
    }
    req.user = currentUser;
    next();
});
const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user?.role)) {
            return next(new appError_1.default('You do not have permission to perform this action', 403));
        }
        next();
    };
};
exports.restrictTo = restrictTo;
const checkPermission = (...permissions) => {
    return (0, catchAsync_1.catchAsync)(async (req, res, next) => {
        if (!req.user) {
            return next(new appError_1.default('You are not logged in!', 401));
        }
        // Super Admin has full unrestricted access
        if (req.user.role === user_model_1.UserRole.ADMIN && (!req.user.customRole || req.user.customRole === 'super-admin')) {
            return next();
        }
        // Check permissions defined for customRole
        if (req.user.customRole) {
            const rolePerm = await role_model_1.default.findOne({ roleName: req.user.customRole.toLowerCase() });
            if (rolePerm) {
                if (permissions.length === 0)
                    return next();
                const hasAny = permissions.some(p => rolePerm.permissions.includes(p));
                if (hasAny)
                    return next();
            }
        }
        return next(new appError_1.default('You do not have permission to perform this action', 403));
    });
};
exports.checkPermission = checkPermission;
