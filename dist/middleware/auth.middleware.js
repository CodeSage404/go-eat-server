"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restrictTo = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importDefault(require("../models/user.model"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
exports.protect = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    // 1) Getting token and check if it's there
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        return next(new appError_1.default('You are not logged in! Please log in to get access.', 401));
    }
    // Verification token
    const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
    // Check if user still exists
    const currentUser = await user_model_1.default.findById(decoded.id);
    if (!currentUser) {
        return next(new appError_1.default('The user belonging to this token no longer exists.', 401));
    }
    // Check if user is suspended
    if (currentUser.status === 'suspended') {
        return next(new appError_1.default('Your account has been suspended. Please contact support.', 403));
    }
    // GRANT ACCESS TO PROTECTED ROUTE
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
