import mongoose, { Schema, Document } from 'mongoose';

export enum TransactionType {
  EARNING = 'earning',       // e.g., order delivery fee or outlet sale
  SETTLEMENT = 'settlement',   // e.g., net order settlement credit
  COMMISSION = 'commission',   // e.g., 15% platform commission deduction
  WITHDRAWAL = 'withdrawal', // e.g., payout to bank
  CANCELLATION_COMPENSATION = 'cancellation_compensation', // e.g. courier compensation
  REFUND = 'refund',
  HOLD = 'hold',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface ITransaction extends Document {
  wallet: mongoose.Types.ObjectId;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  description: string;
  reference?: string; // e.g., order ID or bank transfer ref
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    wallet: {
      type: Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING,
    },
    description: {
      type: String,
      required: true,
    },
    reference: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);

export default Transaction;
