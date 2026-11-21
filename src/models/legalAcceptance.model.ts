import mongoose, { Schema, Document } from 'mongoose';
import { LegalDocumentType, LegalCountryCode } from './legalDocument.model';

export interface ILegalAcceptance extends Document {
  userId: mongoose.Types.ObjectId;
  userName: string;
  userEmail: string;
  userRole: 'user' | 'rider' | 'partner' | 'vendor' | 'admin';
  country: LegalCountryCode;
  documentType: LegalDocumentType;
  documentId: mongoose.Types.ObjectId;
  documentVersion: string;
  documentTitle: string;
  acceptedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  repeatDueAt: Date; // e.g. 6 months after acceptance
  notificationSent: boolean;
  emailSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const legalAcceptanceSchema = new Schema<ILegalAcceptance>(
  {
    userId: {
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
      index: true,
    },
    userRole: {
      type: String,
      required: true,
      enum: ['user', 'rider', 'partner', 'vendor', 'admin'],
      default: 'user',
      index: true,
    },
    country: {
      type: String,
      required: true,
      enum: ['NG', 'UK', 'IT', 'ALL'],
      default: 'NG',
      index: true,
    },
    documentType: {
      type: String,
      required: true,
      enum: [
        'privacy_policy',
        'cookies_policy',
        'fees_charges_commissions',
        'cancellation_return_policy',
        'seller_terms_conditions',
        'buyer_terms_fair_use',
      ],
      index: true,
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'LegalDocument',
      required: true,
    },
    documentVersion: {
      type: String,
      required: true,
    },
    documentTitle: {
      type: String,
      required: true,
    },
    acceptedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    repeatDueAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months in future
      index: true,
    },
    notificationSent: {
      type: Boolean,
      default: false,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

legalAcceptanceSchema.index({ userId: 1, documentType: 1, documentVersion: 1 });
legalAcceptanceSchema.index({ country: 1, acceptedAt: -1 });

const LegalAcceptance = mongoose.model<ILegalAcceptance>('LegalAcceptance', legalAcceptanceSchema);
export default LegalAcceptance;
