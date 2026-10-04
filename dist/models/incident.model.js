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
const incidentSchema = new mongoose_1.Schema({
    courier: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Incident must be submitted by a courier'],
    },
    order: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Order',
    },
    issueType: {
        type: String,
        required: [true, 'Incident issue type is required'],
        trim: true,
    },
    issueTitle: {
        type: String,
        required: [true, 'Incident issue title is required'],
        trim: true,
    },
    notes: {
        type: String,
        required: [true, 'Incident details/notes are required'],
        trim: true,
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
    },
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'resolved'],
        default: 'pending',
    },
    resolvedAt: {
        type: Date,
    },
    resolvedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    resolutionNotes: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
});
incidentSchema.index({ courier: 1 });
incidentSchema.index({ order: 1 });
incidentSchema.index({ status: 1 });
incidentSchema.index({ createdAt: -1 });
const Incident = mongoose_1.default.model('Incident', incidentSchema);
exports.default = Incident;
