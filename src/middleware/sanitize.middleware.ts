import { Request, Response, NextFunction } from 'express';

function sanitizeInPlace(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = sanitizeInPlace(obj[i]);
    }
    return obj;
  }

  // Handle plain objects
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      const safeKey = key.replace(/^\$|\./g, '_');
      const value = sanitizeInPlace(obj[key]);
      obj[safeKey] = value;
      delete obj[key];
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeInPlace(obj[key]);
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
