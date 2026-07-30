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
const mongoose_1 = __importStar(require("mongoose"));
const documentSchema = new mongoose_1.Schema({
    documentName: {
        type: String,
        required: [true, 'Document name is required'],
        trim: true,
    },
    documentType: {
        type: String,
        required: [true, 'Document type is required'],
        trim: true,
    },
    uploadDate: {
        type: Date,
        default: Date.now,
    },
    expiryDate: {
        type: Date,
    },
    issueDate: {
        type: Date,
    },
    verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected', 'expired', 'update_requested'],
        default: 'pending',
    },
    ownerType: {
        type: String,
        enum: ['Vendor', 'Rider'],
        required: true,
    },
    ownerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: true,
    },
    fileUrl: {
        type: String,
        required: [true, 'File URL is required'],
    },
    rejectionReason: {
        type: String,
        trim: true,
    },
    expiryAlertSent: {
        type: String,
        enum: ['none', '30_days', '14_days', '7_days', 'expired'],
        default: 'none',
    },
}, {
    timestamps: true,
});
documentSchema.index({ ownerType: 1, ownerId: 1 });
documentSchema.index({ expiryDate: 1, verificationStatus: 1 });
const DocumentModel = mongoose_1.default.model('Document', documentSchema);
exports.default = DocumentModel;
