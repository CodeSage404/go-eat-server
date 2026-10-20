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
exports.DeletionRequestStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var DeletionRequestStatus;
(function (DeletionRequestStatus) {
    DeletionRequestStatus["PENDING"] = "pending";
    DeletionRequestStatus["PROCESSING"] = "processing";
    DeletionRequestStatus["COMPLETED"] = "completed";
    DeletionRequestStatus["CANCELLED"] = "cancelled";
})(DeletionRequestStatus || (exports.DeletionRequestStatus = DeletionRequestStatus = {}));
const accountDeletionRequestSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    userName: {
        type: String,
        required: true,
        trim: true,
    },
    userEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    userPhone: {
        type: String,
        trim: true,
    },
    reasons: {
        type: [String],
        required: true,
        validate: {
            validator: (v) => Array.isArray(v) && v.length > 0,
            message: 'At least one reason must be selected for account deletion.',
        },
    },
    feedback: {
        type: String,
        trim: true,
        default: '',
    },
    status: {
        type: String,
        enum: Object.values(DeletionRequestStatus),
        default: DeletionRequestStatus.PENDING,
        index: true,
    },
    requestedAt: {
        type: Date,
        default: Date.now,
    },
    scheduledWipeAt: {
        type: Date,
        required: true,
        index: true,
    },
    wipedAt: {
        type: Date,
    },
    adminNotes: {
        type: String,
        trim: true,
        default: '',
    },
}, {
    timestamps: true,
});
accountDeletionRequestSchema.index({ status: 1, scheduledWipeAt: 1 });
const AccountDeletionRequest = mongoose_1.default.model('AccountDeletionRequest', accountDeletionRequestSchema);
exports.default = AccountDeletionRequest;
