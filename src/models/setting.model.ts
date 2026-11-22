import mongoose, { Schema, Document } from 'mongoose';

export interface ICountryPaymentProvider {
  countryCode: string;
  countryName: string;
  provider: 'paystack' | 'flutterwave' | 'stripe' | 'monnify' | 'bachs';
  isActive: boolean;
}

export interface ICountryBankVerificationProvider {
  countryCode: string;
  countryName: string;
  provider: 'paystack' | 'stripe' | 'flutterwave' | 'monnify';
  accountFormat: 'nuban' | 'uk_sort_code' | 'iban' | 'us_routing' | 'general';
  isActive: boolean;
}

export interface IFreeDeliveryTier {
  maxDistanceKm: number;
  minBasketAmount: number;
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
  deliveryFeeCalculationMode: 'dynamic_distance' | 'fixed';
  fixedDeliveryFee: number;
  serviceFee: number;
  smallOrderFee: number;
  smallOrderFeeThreshold: number;
  batchPickupThresholdKm: number;
  multiOutletExtraStopFee: number;
  riderBasePayout: number;
  riderPerKmPayout: number;
  riderPayoutSchedule: 'daily' | 'weekly';
  riderPayoutDayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  defaultPaymentProvider: 'paystack' | 'flutterwave' | 'stripe' | 'monnify' | 'bachs';
  enablePaystack: boolean;
  enableFlutterwave: boolean;
  enableStripe: boolean;
  enableMonnify: boolean;
  enableBachs: boolean;
  bachsApiKey?: string;
  bachsSecretKey?: string;
  bachsWebhookSecret?: string;
  bachsMode?: 'sandbox' | 'live';
  stripePublicKey?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripeMode?: 'sandbox' | 'live';
  monnifyApiKey?: string;
  monnifySecretKey?: string;
  monnifyContractCode?: string;
  monnifyWalletAccountNumber?: string;
  monnifyMode?: 'sandbox' | 'live';
  forceGlobalPaymentProvider: 'none' | 'paystack' | 'flutterwave' | 'stripe' | 'monnify' | 'bachs';
  countryPaymentProviders: ICountryPaymentProvider[];
  // Bank Account Verification Configuration
  defaultBankVerificationProvider: 'paystack' | 'stripe' | 'flutterwave' | 'monnify';
  enableBankVerificationPaystack: boolean;
  enableBankVerificationStripe: boolean;
  enableBankVerificationMonnify?: boolean;
  forceGlobalBankVerificationProvider: 'none' | 'paystack' | 'stripe' | 'flutterwave' | 'monnify';
  countryBankVerificationProviders: ICountryBankVerificationProvider[];
  // First Bite Free Order Campaign Configuration
  firstBiteEnabled: boolean;
  firstBiteCampaignTitle: string;
  firstBiteDescription: string;
  firstBiteIsTotallyFree: boolean;
  firstBiteMaxFreeAmount: number;
  // Free Delivery Distance & Basket Threshold Tier Structure
  enableFreeDeliveryTiers: boolean;
  freeDeliveryTiers: IFreeDeliveryTier[];
  // Express / Priority Delivery
  enableExpressDelivery: boolean;
  expressDeliverySurcharge: number;
  // Rider Payout Policy Controls
  maxWeeklyWithdrawals: number;
  enforceStrictBankNameMatch: boolean;
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
    deliveryFeeCalculationMode: {
      type: String,
      enum: ['dynamic_distance', 'fixed'],
      default: 'dynamic_distance',
    },
    fixedDeliveryFee: { type: Number, default: 500 },
    serviceFee: { type: Number, default: 170 },
    smallOrderFee: { type: Number, default: 150 },
    smallOrderFeeThreshold: { type: Number, default: 1000 },
    batchPickupThresholdKm: { type: Number, default: 3.0 },
    multiOutletExtraStopFee: { type: Number, default: 300 },
    riderBasePayout: { type: Number, default: 400 },
    riderPerKmPayout: { type: Number, default: 80 },
    riderPayoutSchedule: {
      type: String,
      enum: ['daily', 'weekly'],
      default: 'weekly',
    },
    riderPayoutDayOfWeek: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      default: 'friday',
    },
    defaultPaymentProvider: { type: String, enum: ['bachs', 'stripe', 'paystack', 'flutterwave', 'monnify'], default: 'bachs' },
    enablePaystack: { type: Boolean, default: false },
    enableFlutterwave: { type: Boolean, default: false },
    enableStripe: { type: Boolean, default: true },
    enableMonnify: { type: Boolean, default: false },
    enableBachs: { type: Boolean, default: true },
    bachsApiKey: { type: String, trim: true },
    bachsSecretKey: { type: String, trim: true },
    bachsWebhookSecret: { type: String, trim: true },
    bachsMode: { type: String, enum: ['sandbox', 'live'], default: 'live' },
    stripePublicKey: { type: String, trim: true },
    stripeSecretKey: { type: String, trim: true },
    stripeWebhookSecret: { type: String, trim: true },
    stripeMode: { type: String, enum: ['sandbox', 'live'], default: 'live' },
    monnifyApiKey: { type: String, trim: true },
    monnifySecretKey: { type: String, trim: true },
    monnifyContractCode: { type: String, trim: true },
    monnifyWalletAccountNumber: { type: String, trim: true },
    monnifyMode: { type: String, enum: ['sandbox', 'live'], default: 'sandbox' },
    forceGlobalPaymentProvider: {
      type: String,
      enum: ['none', 'paystack', 'flutterwave', 'stripe', 'monnify', 'bachs'],
      default: 'none',
    },
    countryPaymentProviders: {
      type: [
        {
          countryCode: { type: String, uppercase: true },
          countryName: { type: String },
          provider: { type: String, enum: ['paystack', 'flutterwave', 'stripe', 'monnify', 'bachs'] },
          isActive: { type: Boolean, default: true },
        },
      ],
      default: [
        { countryCode: 'NG', countryName: 'Nigeria', provider: 'bachs', isActive: true },
        { countryCode: 'GB', countryName: 'United Kingdom', provider: 'stripe', isActive: true },
        { countryCode: 'IT', countryName: 'Italy', provider: 'stripe', isActive: true },
      ],
    },
    defaultBankVerificationProvider: {
      type: String,
      enum: ['stripe', 'monnify', 'paystack', 'flutterwave'],
      default: 'stripe',
    },
    enableBankVerificationPaystack: { type: Boolean, default: false },
    enableBankVerificationStripe: { type: Boolean, default: true },
    forceGlobalBankVerificationProvider: {
      type: String,
      enum: ['none', 'stripe', 'monnify', 'paystack', 'flutterwave'],
      default: 'none',
    },
    countryBankVerificationProviders: {
      type: [
        {
          countryCode: { type: String, uppercase: true },
          countryName: { type: String },
          provider: { type: String, enum: ['stripe', 'monnify', 'paystack', 'flutterwave'] },
          accountFormat: {
            type: String,
            enum: ['nuban', 'uk_sort_code', 'iban', 'us_routing', 'general'],
            default: 'nuban',
          },
          isActive: { type: Boolean, default: true },
        },
      ],
      default: [
        { countryCode: 'NG', countryName: 'Nigeria', provider: 'stripe', accountFormat: 'nuban', isActive: true },
        { countryCode: 'GB', countryName: 'United Kingdom', provider: 'stripe', accountFormat: 'uk_sort_code', isActive: true },
        { countryCode: 'IT', countryName: 'Italy', provider: 'stripe', accountFormat: 'iban', isActive: true },
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
    // Free Delivery Distance & Basket Threshold Tier Structure
    enableFreeDeliveryTiers: {
      type: Boolean,
      default: true,
    },
    freeDeliveryTiers: {
      type: [
        {
          maxDistanceKm: { type: Number, required: true },
          minBasketAmount: { type: Number, required: true },
        },
      ],
      default: [
        { maxDistanceKm: 2, minBasketAmount: 10000 },
        { maxDistanceKm: 3, minBasketAmount: 15000 },
        { maxDistanceKm: 5, minBasketAmount: 20000 },
      ],
    },
    // Express / Priority Delivery
    enableExpressDelivery: {
      type: Boolean,
      default: true,
    },
    expressDeliverySurcharge: {
      type: Number,
      default: 800,
    },
    // Rider Payout Policy Controls
    maxWeeklyWithdrawals: {
      type: Number,
      default: 3,
    },
    enforceStrictBankNameMatch: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Setting = mongoose.model<ISetting>('Setting', settingSchema);
export default Setting;
