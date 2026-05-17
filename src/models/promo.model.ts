import mongoose, { Schema, Document } from 'mongoose';

export interface IPromo extends Document {
  code: string;
  discountPercentage: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  expiryDate: Date;
  isActive: boolean;
  usageLimit?: number;
  usedCount: number;
  restaurant?: mongoose.Types.ObjectId; // If null, applies to all restaurants
  createdAt: Date;
  updatedAt: Date;
}

const promoSchema = new Schema<IPromo>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    maxDiscountAmount: {
      type: Number,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    usageLimit: {
      type: Number,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
    },
  },
  {
    timestamps: true,
  }
);

const Promo = mongoose.model<IPromo>('Promo', promoSchema);

export default Promo;
