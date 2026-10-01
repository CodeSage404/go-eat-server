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
const partnerApplicationSchema = new mongoose_1.Schema({
    businessName: {
        type: String,
        required: [true, 'Business name is required'],
        trim: true,
    },
    businessAddress: {
        type: String,
        required: [true, 'Business address is required'],
        trim: true,
    },
    businessType: {
        type: String,
        required: [true, 'Business type is required'],
        trim: true,
        enum: ['restaurant', 'grocery', 'convenience', 'bakery', 'cafe', 'other'],
        default: 'restaurant',
    },
    ownerName: {
        type: String,
        required: [true, 'Owner name is required'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Email address is required'],
        lowercase: true,
        trim: true,
        index: true,
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true,
    },
    city: {
        type: String,
        trim: true,
        default: '',
    },
    documents: {
        ninUrl: { type: String, default: '' },
        foodHygieneUrl: { type: String, default: '' },
        cacUrl: { type: String, default: '' },
        idNumber: { type: String, default: '' },
    },
    ninUrl: {
        type: String,
        default: '',
    },
    foodHygieneUrl: {
        type: String,
        default: '',
    },
    cacUrl: {
        type: String,
        default: '',
    },
    status: {
        type: String,
        enum: ['pending', 'under_review', 'approved', 'rejected'],
        default: 'pending',
        index: true,
    },
    adminNotes: {
        type: String,
        default: '',
    },
    reviewedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    reviewedAt: {
        type: Date,
    },
    onboardedRestaurant: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Restaurant',
    },
}, {
    timestamps: true,
});
partnerApplicationSchema.index({ createdAt: -1 });
const PartnerApplication = mongoose_1.default.model('PartnerApplication', partnerApplicationSchema);
exports.default = PartnerApplication;
