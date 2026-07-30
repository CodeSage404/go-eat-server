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
const riderOnboardingSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
    },
    dob: {
        type: String,
        required: true,
    },
    phoneNumber: {
        type: String,
        required: true,
    },
    emailAddress: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    residentialAddress: {
        type: String,
        required: true,
    },
    emergencyContact: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        relationship: { type: String },
    },
    ninVerification: {
        nin: { type: String, required: true },
        verifiedName: { type: String },
        status: {
            type: String,
            enum: ['pending', 'verified', 'failed'],
            default: 'pending',
        },
    },
    documents: {
        ninDoc: { type: String },
        driverLicense: { type: String },
        riderPhoto: { type: String },
        selfieVerification: { type: String },
        proofOfAddress: { type: String },
        policeCharacterCert: { type: String },
        guarantorInfo: {
            name: { type: String },
            phone: { type: String },
            address: { type: String },
            documentUrl: { type: String },
        },
        signedAgreementUrl: { type: String },
        governmentIdUrl: { type: String },
        bicycleOwnershipDetails: { type: String },
    },
    vehicle: {
        vehicleType: {
            type: String,
            enum: ['motorcycle', 'bicycle', 'car'],
            required: true,
        },
        registrationNumber: { type: String },
        vehicleLicenseUrl: { type: String },
        insuranceCertificateUrl: { type: String },
        roadWorthinessCertificateUrl: { type: String },
        hackneyPermitUrl: { type: String },
        bicyclePhotoUrl: { type: String },
    },
    financialDetails: {
        bankName: { type: String, required: true },
        accountNumber: { type: String, required: true },
        accountName: { type: String, required: true },
        bvn: { type: String },
        isVerified: { type: Boolean, default: false },
    },
    equipmentChecklist: {
        deliveryBag: { type: Boolean, default: false },
        helmet: { type: Boolean, default: false },
        reflectiveJacket: { type: Boolean, default: false },
        goEatRiderIdCard: { type: Boolean, default: false },
        phoneHolder: { type: Boolean, default: false },
        smartphoneCompatibilityCheck: { type: Boolean, default: false },
    },
    trainingChecklist: {
        foodSafetyHandling: { type: Boolean, default: false },
        customerService: { type: Boolean, default: false },
        deliveryProcedures: { type: Boolean, default: false },
        appUsageTraining: { type: Boolean, default: false },
        cashHandling: { type: Boolean, default: false },
        emergencyIncidentReporting: { type: Boolean, default: false },
    },
    status: {
        type: String,
        enum: [
            'pending_review',
            'documents_submitted',
            'verification_in_progress',
            'training_pending',
            'approved',
            'active',
            'suspended',
            'deactivated',
        ],
        default: 'pending_review',
    },
}, {
    timestamps: true,
});
riderOnboardingSchema.index({ status: 1 });
riderOnboardingSchema.index({ 'ninVerification.status': 1 });
const RiderOnboarding = mongoose_1.default.model('RiderOnboarding', riderOnboardingSchema);
exports.default = RiderOnboarding;
