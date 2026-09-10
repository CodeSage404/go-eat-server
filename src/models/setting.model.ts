import mongoose, { Schema, Document } from 'mongoose';

export interface ICountryPaymentProvider {
  countryCode: string;
  countryName: string;
  provider: 'paystack' | 'flutterwave' | 'stripe';
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
  countryPaymentProviders: ICountryPaymentProvider[];
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
  },
  { timestamps: true }
);

const Setting = mongoose.model<ISetting>('Setting', settingSchema);
export default Setting;
