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
const legalDocumentSchema = new mongoose_1.Schema({
    documentType: {
        type: String,
        required: [true, 'Document type is required'],
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
    targetRole: {
        type: String,
        required: [true, 'Target role is required'],
        enum: ['users', 'riders', 'partners', 'all'],
        default: 'all',
        index: true,
    },
    country: {
        type: String,
        required: [true, 'Country is required'],
        enum: ['NG', 'UK', 'IT', 'ALL'],
        default: 'ALL',
        index: true,
    },
    title: {
        type: String,
        required: [true, 'Document title is required'],
        trim: true,
    },
    content: {
        type: String,
        required: [true, 'Document content is required'],
    },
    version: {
        type: String,
        required: [true, 'Version is required'],
        default: '1.0',
    },
    summaryOfChanges: {
        type: String,
        trim: true,
    },
    effectiveDate: {
        type: Date,
        default: Date.now,
    },
    isPublished: {
        type: Boolean,
        default: true,
        index: true,
    },
    publishedAt: {
        type: Date,
        default: Date.now,
    },
    updatedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});
// Compound index to guarantee fast query by documentType, targetRole, and country
legalDocumentSchema.index({ documentType: 1, targetRole: 1, country: 1, isPublished: 1 });
const LegalDocument = mongoose_1.default.model('LegalDocument', legalDocumentSchema);
exports.default = LegalDocument;
