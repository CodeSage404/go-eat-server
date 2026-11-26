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
exports.OutletSubscription = exports.SUBSCRIPTION_PLAN_CONFIGS = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.SUBSCRIPTION_PLAN_CONFIGS = {
    UK: {
        payg: { tier: 'payg', market: 'UK', currency: 'GBP', monthlyFee: 0, commissionRate: 0.15, foodSalesThreshold: 0, aboveThresholdRate: 0.15 },
        plus: { tier: 'plus', market: 'UK', currency: 'GBP', monthlyFee: 49, commissionRate: 0.05, foodSalesThreshold: 0, aboveThresholdRate: 0.05 },
        unlimited: { tier: 'unlimited', market: 'UK', currency: 'GBP', monthlyFee: 99, commissionRate: 0.0, foodSalesThreshold: 2000, aboveThresholdRate: 0.08 },
    },
    NG: {
        payg: { tier: 'payg', market: 'NG', currency: 'NGN', monthlyFee: 0, commissionRate: 0.15, foodSalesThreshold: 0, aboveThresholdRate: 0.15 },
        plus: { tier: 'plus', market: 'NG', currency: 'NGN', monthlyFee: 69000, commissionRate: 0.05, foodSalesThreshold: 0, aboveThresholdRate: 0.05 },
        unlimited: { tier: 'unlimited', market: 'NG', currency: 'NGN', monthlyFee: 139000, commissionRate: 0.0, foodSalesThreshold: 500000, aboveThresholdRate: 0.08 },
    },
    EU: {
        payg: { tier: 'payg', market: 'EU', currency: 'EUR', monthlyFee: 0, commissionRate: 0.15, foodSalesThreshold: 0, aboveThresholdRate: 0.15 },
        plus: { tier: 'plus', market: 'EU', currency: 'EUR', monthlyFee: 49, commissionRate: 0.05, foodSalesThreshold: 0, aboveThresholdRate: 0.05 },
        unlimited: { tier: 'unlimited', market: 'EU', currency: 'EUR', monthlyFee: 99, commissionRate: 0.0, foodSalesThreshold: 2000, aboveThresholdRate: 0.08 },
    },
};
const OutletSubscriptionSchema = new mongoose_1.Schema({
    restaurantId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    planTier: { type: String, enum: ['payg', 'plus', 'unlimited'], default: 'payg', required: true },
    market: { type: String, enum: ['UK', 'NG', 'EU'], default: 'NG', required: true },
    currency: { type: String, enum: ['GBP', 'NGN', 'EUR'], default: 'NGN', required: true },
    monthlyFee: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'past_due', 'cancelled', 'trialing', 'grace_period', 'pending_verification'], default: 'active' },
    startDate: { type: Date, default: Date.now },
    currentCycleStart: { type: Date, default: Date.now },
    currentCycleEnd: { type: Date, required: true },
    nextRenewalDate: { type: Date, required: true },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    cancelledAt: { type: Date },
    currentCycleFoodSales: { type: Number, default: 0 },
    foodSalesThreshold: { type: Number, default: 0 },
    isFoundingPartnerPromo: { type: Boolean, default: false },
    foundingPartnerPromoEnd: { type: Date },
    bacsMandate: {
        accountHolderName: { type: String },
        sortCode: { type: String },
        accountNumberMasked: { type: String },
        bankName: { type: String },
        mandateReference: { type: String, index: true },
        status: {
            type: String,
            enum: ['none', 'pending_verification', 'active', 'rejected', 'cancelled'],
            default: 'none',
        },
        submittedAt: { type: Date },
        submittedBy: {
            userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
            name: { type: String },
            role: { type: String },
        },
        verifiedAt: { type: Date },
        verifiedBy: {
            userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
            name: { type: String },
        },
        rejectionReason: { type: String },
        customerAgreedGuarantee: { type: Boolean, default: false },
        agreedAt: { type: Date },
        notes: { type: String },
    },
    paymentProvider: { type: String, enum: ['stripe', 'paystack', 'monnify', 'bachs'] },
    processorSubscriptionId: { type: String },
    processorCustomerId: { type: String },
    lastPaymentReference: { type: String },
    lastPaymentDate: { type: Date },
    failedBillingAttempts: { type: Number, default: 0 },
}, { timestamps: true });
exports.OutletSubscription = mongoose_1.default.model('OutletSubscription', OutletSubscriptionSchema);
