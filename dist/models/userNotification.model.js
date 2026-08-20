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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
/**
 * Per-user in-app notification (order updates, promotions, system alerts).
 * Each document represents one notification delivered to one user.
 */
var NotificationType;
(function (NotificationType) {
    NotificationType["ORDER_UPDATE"] = "order_update";
    NotificationType["NEW_ORDER"] = "new_order";
    NotificationType["PROMOTION"] = "promotion";
    NotificationType["SYSTEM"] = "system";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
const userNotificationSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Notification must belong to a user'],
        index: true,
    },
    title: {
        type: String,
        required: [true, 'Notification title is required'],
        trim: true,
    },
    body: {
        type: String,
        required: [true, 'Notification body is required'],
        trim: true,
    },
    type: {
        type: String,
        enum: Object.values(NotificationType),
        default: NotificationType.SYSTEM,
    },
    isRead: {
        type: Boolean,
        default: false,
    },
    orderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Order',
    },
    data: {
        type: mongoose_1.Schema.Types.Mixed,
    },
}, {
    timestamps: true,
});
// Compound index for fast "get my unread notifications" queries
userNotificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
const UserNotification = mongoose_1.default.model('UserNotification', userNotificationSchema);
exports.default = UserNotification;
