import mongoose, { Schema, Document } from 'mongoose';

export type SubscriptionPlanTier = 'payg' | 'plus' | 'unlimited';
export type SubscriptionMarket = 'UK' | 'NG' | 'EU';
export type SubscriptionCurrency = 'GBP' | 'NGN' | 'EUR';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing' | 'grace_period';

export interface ISubscriptionPlanConfig {
  tier: SubscriptionPlanTier;
  market: SubscriptionMarket;
  currency: SubscriptionCurrency;
  monthlyFee: number;
  commissionRate: number; // For Plus: 0.05 (5%). For PAYG: default 0.15 (15%). For Unlimited: 0.00 up to cap, 0.08 above
  foodSalesThreshold: number; // UK: 2000, NG: 500000, EU: 2000. 0 for payg/plus
  aboveThresholdRate: number; // 0.08 for unlimited
}

export const SUBSCRIPTION_PLAN_CONFIGS: Record<SubscriptionMarket, Record<SubscriptionPlanTier, ISubscriptionPlanConfig>> = {
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

export interface IOutletSubscription extends Document {
  restaurantId: mongoose.Types.ObjectId;
  planTier: SubscriptionPlanTier;
  market: SubscriptionMarket;
  currency: SubscriptionCurrency;
  monthlyFee: number;
  status: SubscriptionStatus;
  startDate: Date;
  currentCycleStart: Date;
  currentCycleEnd: Date;
  nextRenewalDate: Date;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  
  // Tracking Food Sales in current cycle for Capped 0% Unlimited Tier
  currentCycleFoodSales: number;
  foodSalesThreshold: number;
  
  // Founding Partner 3-Month 0% Promotion
  isFoundingPartnerPromo: boolean;
  foundingPartnerPromoEnd?: Date;
  
  // Payment Processor details
  paymentProvider?: 'stripe' | 'paystack' | 'monnify' | 'bachs';
  processorSubscriptionId?: string;
  processorCustomerId?: string;
  lastPaymentReference?: string;
  lastPaymentDate?: Date;
  failedBillingAttempts: number;
  
  createdAt: Date;
  updatedAt: Date;
}

const OutletSubscriptionSchema = new Schema<IOutletSubscription>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    planTier: { type: String, enum: ['payg', 'plus', 'unlimited'], default: 'payg', required: true },
    market: { type: String, enum: ['UK', 'NG', 'EU'], default: 'NG', required: true },
    currency: { type: String, enum: ['GBP', 'NGN', 'EUR'], default: 'NGN', required: true },
    monthlyFee: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'past_due', 'cancelled', 'trialing', 'grace_period'], default: 'active' },
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
    
    paymentProvider: { type: String, enum: ['stripe', 'paystack', 'monnify', 'bachs'] },
    processorSubscriptionId: { type: String },
    processorCustomerId: { type: String },
    lastPaymentReference: { type: String },
    lastPaymentDate: { type: Date },
    failedBillingAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const OutletSubscription = mongoose.model<IOutletSubscription>('OutletSubscription', OutletSubscriptionSchema);
