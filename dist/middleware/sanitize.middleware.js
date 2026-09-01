"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mongoSanitizeMiddleware = void 0;
/**
 * Recursively removes / renames dangerous MongoDB operator keys ($ and .)
 * Mutates objects in-place to avoid "Cannot set property query which has only a getter" errors in Express.
 */
function sanitizeInPlace(obj) {
    if (!obj || typeof obj !== 'object')
        return obj;
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
        }
        else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeInPlace(obj[key]);
        }
    }
    return obj;
}
const mongoSanitizeMiddleware = (req, _res, next) => {
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
exports.mongoSanitizeMiddleware = mongoSanitizeMiddleware;
exports.default = exports.mongoSanitizeMiddleware;
