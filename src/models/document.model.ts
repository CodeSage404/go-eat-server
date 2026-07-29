import mongoose, { Schema, Document } from 'mongoose';

export type VerificationStatusType = 
  | 'pending' 
  | 'verified' 
  | 'rejected' 
  | 'expired' 
  | 'update_requested';

export type ExpiryAlertStatus = 
  | 'none' 
  | '30_days' 
  | '14_days' 
  | '7_days' 
  | 'expired';

export interface IDocument extends Document {
  documentName: string;
  documentType: string;
  uploadDate: Date;
  expiryDate?: Date;
  issueDate?: Date;
  verificationStatus: VerificationStatusType;
  ownerType: 'Vendor' | 'Rider';
  ownerId: mongoose.Types.ObjectId;
  fileUrl: string;
  rejectionReason?: string;
  expiryAlertSent: ExpiryAlertStatus;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    documentName: {
      type: String,
      required: [true, 'Document name is required'],
      trim: true,
    },
    documentType: {
      type: String,
      required: [true, 'Document type is required'],
      trim: true,
    },
    uploadDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
    },
    issueDate: {
      type: Date,
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'expired', 'update_requested'],
      default: 'pending',
    },
    ownerType: {
      type: String,
      enum: ['Vendor', 'Rider'],
      required: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    fileUrl: {
      type: String,
      required: [true, 'File URL is required'],
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    expiryAlertSent: {
      type: String,
      enum: ['none', '30_days', '14_days', '7_days', 'expired'],
      default: 'none',
    },
  },
  {
    timestamps: true,
  }
);

documentSchema.index({ ownerType: 1, ownerId: 1 });
documentSchema.index({ expiryDate: 1, verificationStatus: 1 });

const DocumentModel = mongoose.model<IDocument>('Document', documentSchema);

export default DocumentModel;
