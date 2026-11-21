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
const legalAcceptanceSchema = new mongoose_1.Schema({
    userId: {
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
        index: true,
    },
    userRole: {
        type: String,
        required: true,
        enum: ['user', 'rider', 'partner', 'vendor', 'admin'],
        default: 'user',
        index: true,
    },
    country: {
        type: String,
        required: true,
        enum: ['NG', 'UK', 'IT', 'ALL'],
        default: 'NG',
        index: true,
    },
    documentType: {
        type: String,
        required: true,
        enum: [
            'privacy_policy',
            'cookies_policy',
            'fees_charges_commissions',
            'cancellation_return_policy',
            'seller_terms_conditions',
            'buyer_terms_fair_use',
        ],
        index: true,
    },
    documentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'LegalDocument',
        required: true,
    },
    documentVersion: {
        type: String,
        required: true,
    },
    documentTitle: {
        type: String,
        required: true,
    },
    acceptedAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    ipAddress: {
        type: String,
    },
    userAgent: {
        type: String,
    },
    repeatDueAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months in future
        index: true,
    },
    notificationSent: {
        type: Boolean,
        default: false,
    },
    emailSent: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});
legalAcceptanceSchema.index({ userId: 1, documentType: 1, documentVersion: 1 });
legalAcceptanceSchema.index({ country: 1, acceptedAt: -1 });
const LegalAcceptance = mongoose_1.default.model('LegalAcceptance', legalAcceptanceSchema);
exports.default = LegalAcceptance;
