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
const JobSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: [true, 'Job title is required'],
        trim: true,
        maxlength: [150, 'Job title cannot exceed 150 characters'],
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    department: {
        type: String,
        required: [true, 'Department is required'],
        trim: true,
    },
    location: {
        type: String,
        required: [true, 'Job location is required'],
        trim: true,
        default: 'Remote',
    },
    country: {
        type: String,
        default: 'Global',
    },
    countryCode: {
        type: String,
        default: 'ALL',
        uppercase: true,
    },
    type: {
        type: String,
        enum: ['full-time', 'part-time', 'contract', 'internship'],
        default: 'full-time',
    },
    workplaceType: {
        type: String,
        enum: ['remote', 'hybrid', 'on-site'],
        default: 'remote',
    },
    salary: {
        type: String,
        trim: true,
    },
    description: {
        type: String,
        required: [true, 'Job description is required'],
    },
    responsibilities: {
        type: [String],
        default: [],
    },
    requirements: {
        type: [String],
        default: [],
    },
    benefits: {
        type: [String],
        default: [],
    },
    applyEmail: {
        type: String,
        default: 'support@goeatone.com',
        trim: true,
        lowercase: true,
    },
    status: {
        type: String,
        enum: ['active', 'closed', 'draft'],
        default: 'active',
        index: true,
    },
    featured: {
        type: Boolean,
        default: false,
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});
// Indexes for fast searching and sorting
JobSchema.index({ status: 1, createdAt: -1 });
JobSchema.index({ department: 1, status: 1 });
JobSchema.index({ title: 'text', description: 'text', department: 'text' });
const Job = mongoose_1.default.model('Job', JobSchema);
exports.default = Job;
