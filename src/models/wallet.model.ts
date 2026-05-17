import mongoose, { Schema, Document } from 'mongoose';

export interface IWallet extends Document {
  user: mongoose.Types.ObjectId; // Rider or Vendor
  balance: number;
  currency: string;
  lastPayoutDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // One wallet per user
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'NGN', // Nigerian Naira
    },
    lastPayoutDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);

export default Wallet;
