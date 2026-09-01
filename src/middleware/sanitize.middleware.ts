// server/src/middleware/sanitize.middleware.ts - Enterprise In-Place NoSQL Injection Sanitizer
import { Request, Response, NextFunction } from 'express';

/**
 * Recursively sanitizes MongoDB injection operators ($ and .) in-place.
 * Uses a WeakSet to prevent circular reference recursion and ignores binary/Date buffers.
 */
function sanitizeInPlace(obj: any, seen = new WeakSet()): any {
  if (!obj || typeof obj !== 'object') return obj;

  // Skip instances of non-plain objects
  if (obj instanceof Date || obj instanceof RegExp || Buffer.isBuffer(obj)) {
    return obj;
  }

  // Prevent circular reference loops
  if (seen.has(obj)) {
    return obj;
  }
  seen.add(obj);

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = sanitizeInPlace(obj[i], seen);
    }
    return obj;
  }

  // Sanitize plain object keys & nested values
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      const safeKey = key.replace(/^\$|\./g, '_');
      const value = sanitizeInPlace(obj[key], seen);
      obj[safeKey] = value;
      delete obj[key];
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeInPlace(obj[key], seen);
    }
  }

  return obj;
}

export const mongoSanitizeMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    sanitizeInPlace(req.body);
  }
  if (req.params && typeof req.params === 'object') {
    sanitizeInPlace(req.params);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeInPlace(req.query);
  }
  next();
};

export default mongoSanitizeMiddleware;
