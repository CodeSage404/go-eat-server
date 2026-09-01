// middleware/rateLimiter.ts - Security Rate Limiters for Sensitive API Endpoints

import rateLimit from 'express-rate-limit';

/**
 * Strict Rate Limiter for Authentication (Login, Register, Password Reset)
 * 15 minutes window, max 15 requests per IP
 */
export const authLimiter = rateLimit({
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
export const otpLimiter = rateLimit({
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
export const pinVerificationLimiter = rateLimit({
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
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    message: 'Too many requests created from this IP. Please try again later.',
  },
});
