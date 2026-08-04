import mongoose, { Schema, Document } from 'mongoose';

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
  defaultPaymentProvider: 'paystack' | 'flutterwave';
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
    defaultPaymentProvider: { type: String, enum: ['paystack', 'flutterwave'], default: 'paystack' },
  },
  { timestamps: true }
);

const Setting = mongoose.model<ISetting>('Setting', settingSchema);
export default Setting;
