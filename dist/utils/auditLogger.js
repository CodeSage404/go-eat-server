"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPlatformActivity = logPlatformActivity;
const auditLog_model_1 = __importDefault(require("../models/auditLog.model"));
/**
 * Persists a high-level operational activity / audit log entry in the database.
 */
async function logPlatformActivity(params) {
    try {
        await auditLog_model_1.default.create({
            user: params.user || 'System',
            action: params.action,
            category: params.category || 'general',
            ipAddress: params.ipAddress || '127.0.0.1',
            status: params.status || 'success',
        });
    }
    catch (err) {
        console.warn('Failed to write platform audit log:', err);
    }
}
