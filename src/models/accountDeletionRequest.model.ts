import mongoose, { Schema, Document } from 'mongoose';

export enum DeletionRequestStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface IAccountDeletionRequest extends Document {
  user: mongoose.Types.ObjectId;
  userName: string;
  userEmail: string;
  userPhone?: string;
  reasons: string[];
  feedback?: string;
  status: DeletionRequestStatus;
  requestedAt: Date;
  scheduledWipeAt: Date;
  wipedAt?: Date;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const accountDeletionRequestSchema = new Schema<IAccountDeletionRequest>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    userEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    userPhone: {
      type: String,
      trim: true,
    },
    reasons: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length > 0,
        message: 'At least one reason must be selected for account deletion.',
      },
    },
    feedback: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: Object.values(DeletionRequestStatus),
      default: DeletionRequestStatus.PENDING,
      index: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    scheduledWipeAt: {
      type: Date,
      required: true,
      index: true,
    },
    wipedAt: {
      type: Date,
    },
    adminNotes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

accountDeletionRequestSchema.index({ status: 1, scheduledWipeAt: 1 });

const AccountDeletionRequest = mongoose.model<IAccountDeletionRequest>(
  'AccountDeletionRequest',
  accountDeletionRequestSchema
);

export default AccountDeletionRequest;
