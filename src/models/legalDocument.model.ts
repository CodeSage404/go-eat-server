import mongoose, { Schema, Document } from 'mongoose';

export type LegalDocumentType =
  | 'privacy_policy'
  | 'cookies_policy'
  | 'fees_charges_commissions'
  | 'cancellation_return_policy'
  | 'seller_terms_conditions'
  | 'buyer_terms_fair_use';

export type LegalTargetRole = 'users' | 'riders' | 'partners' | 'all';
export type LegalCountryCode = 'NG' | 'UK' | 'IT' | 'ALL';

export interface ILegalDocument extends Document {
  documentType: LegalDocumentType;
  targetRole: LegalTargetRole;
  country: LegalCountryCode;
  title: string;
  content: string;
  version: string;
  summaryOfChanges?: string;
  effectiveDate: Date;
  isPublished: boolean;
  publishedAt?: Date;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const legalDocumentSchema = new Schema<ILegalDocument>(
  {
    documentType: {
      type: String,
      required: [true, 'Document type is required'],
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
    targetRole: {
      type: String,
      required: [true, 'Target role is required'],
      enum: ['users', 'riders', 'partners', 'all'],
      default: 'all',
      index: true,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      enum: ['NG', 'UK', 'IT', 'ALL'],
      default: 'ALL',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Document content is required'],
    },
    version: {
      type: String,
      required: [true, 'Version is required'],
      default: '1.0',
    },
    summaryOfChanges: {
      type: String,
      trim: true,
    },
    effectiveDate: {
      type: Date,
      default: Date.now,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to guarantee fast query by documentType, targetRole, and country
legalDocumentSchema.index({ documentType: 1, targetRole: 1, country: 1, isPublished: 1 });

const LegalDocument = mongoose.model<ILegalDocument>('LegalDocument', legalDocumentSchema);
export default LegalDocument;
