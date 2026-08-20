import mongoose, { Schema, Document } from 'mongoose';

export interface IWallet extends Document {
  user: mongoose.Types.ObjectId; // Rider or Vendor
  balance: number; // Available withdrawable balance
  availableBalance: number; // Alias for withdrawable balance
  pendingBalance: number; // Accepted orders in progress
  currency: string;
  bankAccount?: {
    accountNumber: string;
    bankCode: string;
    accountName: string;
    recipientCode?: string;
  };
  lastPayoutDate?: Date;
  isSettlementOnHold: boolean;
  holdReason?: string;
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
    availableBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    pendingBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'NGN', // Nigerian Naira
    },
    bankAccount: {
      accountNumber: { type: String, trim: true },
      bankCode: { type: String, trim: true },
      accountName: { type: String, trim: true },
      recipientCode: { type: String, trim: true },
    },
    lastPayoutDate: {
      type: Date,
    },
    isSettlementOnHold: {
      type: Boolean,
      default: false,
    },
    holdReason: {
      type: String,
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

// Sync balance and availableBalance pre-save
walletSchema.pre('save', function (next) {
  if (this.isModified('balance') && !this.isModified('availableBalance')) {
    this.availableBalance = this.balance;
  } else if (this.isModified('availableBalance') && !this.isModified('balance')) {
    this.balance = this.availableBalance;
  }
  next();
});

const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);

export default Wallet;
