"use strict";
// middleware/rateLimiter.ts - Security Rate Limiters for Sensitive API Endpoints
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiLimiter = exports.pinVerificationLimiter = exports.otpLimiter = exports.authLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
/**
 * Strict Rate Limiter for Authentication (Login, Register, Password Reset)
 * 15 minutes window, max 15 requests per IP
 */
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'fail',
        message: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.',
    },
});
/**
 * High-Sensitivity Rate Limiter for SMS/OTP Dispatch & Verification
 * 5 minutes window, max 5 requests per IP
 */
exports.otpLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'fail',
        message: 'Too many OTP requests. Please wait 5 minutes before requesting or trying another code.',
    },
});
/**
 * Rate Limiter for Delivery PIN Verification
 * 5 minutes window, max 10 attempts per IP
 */
exports.pinVerificationLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'fail',
        message: 'Too many PIN verification attempts. Please wait a few minutes before trying again.',
    },
});
/**
 * General API Limiter for Public Read-Heavy Endpoints
 * 15 minutes window, max 300 requests per IP
 */
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'fail',
        message: 'Too many requests created from this IP. Please try again later.',
    },
});
