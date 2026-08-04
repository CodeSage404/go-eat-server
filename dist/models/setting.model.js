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
const settingSchema = new mongoose_1.Schema({
    appName: { type: String, default: 'Go-Eat' },
    supportEmail: { type: String, default: 'support@goeatng.com' },
    commissionRate: { type: Number, default: 10 },
    maxDeliveryDistance: { type: Number, default: 15 },
    maintenanceMode: { type: Boolean, default: false },
    enableNotifications: { type: Boolean, default: true },
    minOrderAmount: { type: Number, default: 500 },
    deliveryBaseFee: { type: Number, default: 500 },
    deliveryFeePerKm: { type: Number, default: 100 },
    defaultPaymentProvider: { type: String, enum: ['paystack', 'flutterwave', 'stripe'], default: 'paystack' },
    countryPaymentProviders: {
        type: [
            {
                countryCode: { type: String, uppercase: true },
                countryName: { type: String },
                provider: { type: String, enum: ['paystack', 'flutterwave', 'stripe'] },
                isActive: { type: Boolean, default: true },
            },
        ],
        default: [
            { countryCode: 'NG', countryName: 'Nigeria', provider: 'paystack', isActive: true },
            { countryCode: 'GB', countryName: 'United Kingdom', provider: 'stripe', isActive: true },
            { countryCode: 'US', countryName: 'United States', provider: 'stripe', isActive: true },
            { countryCode: 'IT', countryName: 'Italy', provider: 'stripe', isActive: true },
            { countryCode: 'CA', countryName: 'Canada', provider: 'stripe', isActive: true },
            { countryCode: 'GH', countryName: 'Ghana', provider: 'paystack', isActive: true },
            { countryCode: 'KE', countryName: 'Kenya', provider: 'flutterwave', isActive: true },
        ],
    },
}, { timestamps: true });
const Setting = mongoose_1.default.model('Setting', settingSchema);
exports.default = Setting;
