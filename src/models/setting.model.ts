import mongoose, { Schema, Document } from 'mongoose';

export interface ICountryPaymentProvider {
  countryCode: string;
  countryName: string;
  provider: 'paystack' | 'flutterwave' | 'stripe';
  isActive: boolean;
}

export interface ICountryBankVerificationProvider {
  countryCode: string;
  countryName: string;
  provider: 'paystack' | 'stripe' | 'flutterwave';
  accountFormat: 'nuban' | 'uk_sort_code' | 'iban' | 'us_routing' | 'general';
  isActive: boolean;
}

export interface ISetting extends Document {
  appName: string;
  supportEmail: string;
  commissionRate: number;
  maxDeliveryDistance: number;
  maintenanceMode: boolean;
  enableNotifications: boolean;
  minOrderAmount: number;
  deliveryBaseFee: number;
  deliveryFeePerKm: number;
  serviceFee: number;
  smallOrderFee: number;
  smallOrderFeeThreshold: number;
  batchPickupThresholdKm: number;
  multiOutletExtraStopFee: number;
  riderBasePayout: number;
  riderPerKmPayout: number;
  defaultPaymentProvider: 'paystack' | 'flutterwave' | 'stripe';
  enablePaystack: boolean;
  enableFlutterwave: boolean;
  enableStripe: boolean;
  forceGlobalPaymentProvider: 'none' | 'paystack' | 'flutterwave' | 'stripe';
  countryPaymentProviders: ICountryPaymentProvider[];
  // Bank Account Verification Configuration
  defaultBankVerificationProvider: 'paystack' | 'stripe' | 'flutterwave';
  enableBankVerificationPaystack: boolean;
  enableBankVerificationStripe: boolean;
  forceGlobalBankVerificationProvider: 'none' | 'paystack' | 'stripe' | 'flutterwave';
  countryBankVerificationProviders: ICountryBankVerificationProvider[];
  // First Bite Free Order Campaign Configuration
  firstBiteEnabled: boolean;
  firstBiteCampaignTitle: string;
  firstBiteDescription: string;
  firstBiteIsTotallyFree: boolean;
  firstBiteMaxFreeAmount: number;
}

const settingSchema = new Schema<ISetting>(
  {
    appName: { type: String, default: 'Go-Eat' },
    supportEmail: { type: String, default: 'support@goeatng.com' },
    commissionRate: { type: Number, default: 10 },
    maxDeliveryDistance: { type: Number, default: 15 },
    maintenanceMode: { type: Boolean, default: false },
    enableNotifications: { type: Boolean, default: true },
    minOrderAmount: { type: Number, default: 500 },
    deliveryBaseFee: { type: Number, default: 500 },
    deliveryFeePerKm: { type: Number, default: 100 },
    serviceFee: { type: Number, default: 170 },
    smallOrderFee: { type: Number, default: 150 },
    smallOrderFeeThreshold: { type: Number, default: 1000 },
    batchPickupThresholdKm: { type: Number, default: 3.0 },
    multiOutletExtraStopFee: { type: Number, default: 300 },
    riderBasePayout: { type: Number, default: 400 },
    riderPerKmPayout: { type: Number, default: 80 },
    defaultPaymentProvider: { type: String, enum: ['paystack', 'flutterwave', 'stripe'], default: 'paystack' },
    enablePaystack: { type: Boolean, default: true },
    enableFlutterwave: { type: Boolean, default: true },
    enableStripe: { type: Boolean, default: true },
    forceGlobalPaymentProvider: {
      type: String,
      enum: ['none', 'paystack', 'flutterwave', 'stripe'],
      default: 'none',
    },
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
    defaultBankVerificationProvider: {
      type: String,
      enum: ['paystack', 'stripe', 'flutterwave'],
      default: 'paystack',
    },
    enableBankVerificationPaystack: { type: Boolean, default: true },
    enableBankVerificationStripe: { type: Boolean, default: true },
    forceGlobalBankVerificationProvider: {
      type: String,
      enum: ['none', 'paystack', 'stripe', 'flutterwave'],
      default: 'none',
    },
    countryBankVerificationProviders: {
      type: [
        {
          countryCode: { type: String, uppercase: true },
          countryName: { type: String },
          provider: { type: String, enum: ['paystack', 'stripe', 'flutterwave'] },
          accountFormat: {
            type: String,
            enum: ['nuban', 'uk_sort_code', 'iban', 'us_routing', 'general'],
            default: 'nuban',
          },
          isActive: { type: Boolean, default: true },
        },
      ],
      default: [
        { countryCode: 'NG', countryName: 'Nigeria', provider: 'paystack', accountFormat: 'nuban', isActive: true },
        { countryCode: 'GB', countryName: 'United Kingdom', provider: 'stripe', accountFormat: 'uk_sort_code', isActive: true },
        { countryCode: 'IT', countryName: 'Italy', provider: 'stripe', accountFormat: 'iban', isActive: true },
        { countryCode: 'US', countryName: 'United States', provider: 'stripe', accountFormat: 'us_routing', isActive: true },
        { countryCode: 'CA', countryName: 'Canada', provider: 'stripe', accountFormat: 'general', isActive: true },
        { countryCode: 'GH', countryName: 'Ghana', provider: 'paystack', accountFormat: 'nuban', isActive: true },
        { countryCode: 'KE', countryName: 'Kenya', provider: 'flutterwave', accountFormat: 'nuban', isActive: true },
      ],
    },
    // First Bite Free Order Campaign Configuration
    firstBiteEnabled: {
      type: Boolean,
      default: false,
    },
    firstBiteCampaignTitle: {
      type: String,
      default: 'Your First Bite is on Us',
    },
    firstBiteDescription: {
      type: String,
      default: 'Enjoy your first meal on us as a welcome gift from Go-Eat!',
    },
    firstBiteIsTotallyFree: {
      type: Boolean,
      default: true,
    },
    firstBiteMaxFreeAmount: {
      type: Number,
      default: 3000,
    },
  },
  { timestamps: true }
);

const Setting = mongoose.model<ISetting>('Setting', settingSchema);
export default Setting;
