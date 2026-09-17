import mongoose, { Schema, Document } from 'mongoose';

export interface IPromoBanner extends Document {
  isActive: boolean;
  headline: string;
  subtitle: string;
  ctaText: string;
  ctaLink?: string;
  voucherText?: string;
  imageUrl?: string;
  backgroundColor?: string;
  backgroundColorDark?: string;
  createdAt: Date;
  updatedAt: Date;
}

const promoBannerSchema = new Schema<IPromoBanner>(
  {
    isActive: {
      type: Boolean,
      default: true,
    },
    headline: {
      type: String,
      default: 'Save ₦3,000',
      trim: true,
    },
    subtitle: {
      type: String,
      default: 'Enjoy ₦1,000 off your first three orders. Min. spend applies. T&Cs apply.',
      trim: true,
    },
    ctaText: {
      type: String,
      default: 'Order now',
      trim: true,
    },
    ctaLink: {
      type: String,
      default: '/voucher',
      trim: true,
    },
    voucherText: {
      type: String,
      default: '₦1,000 off',
      trim: true,
    },
    imageUrl: {
      type: String,
      default: '',
      trim: true,
    },
    backgroundColor: {
      type: String,
      default: '#F5B743',
      trim: true,
    },
    backgroundColorDark: {
      type: String,
      default: '#D99B26',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const PromoBanner = mongoose.model<IPromoBanner>('PromoBanner', promoBannerSchema);

export default PromoBanner;
