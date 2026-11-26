import mongoose, { Schema, Document } from 'mongoose';

export type PartnerApplicationStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'declined';

export interface IPartnerDocuments {
  ninUrl?: string;
  ninExpiryDate?: Date;
  foodHygieneUrl?: string;
  foodHygieneExpiryDate?: Date;
  cacUrl?: string;
  cacExpiryDate?: Date;
  idNumber?: string;
  isDocumentExpired?: boolean;
  expiredDocuments?: string[];
}

export interface IPartnerApplication extends Document {
  businessName: string;
  businessAddress: string;
  businessType: string;
  ownerName: string;
  email: string;
  phoneNumber: string;
  city?: string;
  applicationType?: 'quick' | 'full';
  hasAccessGranted?: boolean;
  documents?: IPartnerDocuments;
  ninUrl?: string;
  ninExpiryDate?: Date;
  foodHygieneUrl?: string;
  foodHygieneExpiryDate?: Date;
  cacUrl?: string;
  cacExpiryDate?: Date;
  isDocumentExpired?: boolean;
  expiredDocuments?: string[];
  businessImageUrl?: string;
  coverImageUrl?: string;
  status: PartnerApplicationStatus;
  adminNotes?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  onboardedRestaurant?: mongoose.Types.ObjectId;
  claimCode?: string;
  claimCodeExpiresAt?: Date;
  isClaimed?: boolean;
  claimedAt?: Date;
  optOutToken?: string;
  optedOutAt?: Date;
  optOutReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const partnerApplicationSchema = new Schema<IPartnerApplication>(
  {
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
    },
    businessAddress: {
      type: String,
      required: [true, 'Business address is required'],
      trim: true,
    },
    businessType: {
      type: String,
      required: [true, 'Business type is required'],
      trim: true,
      enum: ['restaurant', 'grocery', 'convenience', 'bakery', 'cafe', 'other'],
      default: 'restaurant',
    },
    ownerName: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    city: {
      type: String,
      trim: true,
      default: '',
    },
    applicationType: {
      type: String,
      enum: ['quick', 'full'],
      default: 'full',
      index: true,
    },
    hasAccessGranted: {
      type: Boolean,
      default: false,
    },
    documents: {
      ninUrl: { type: String, default: '' },
      ninExpiryDate: { type: Date },
      foodHygieneUrl: { type: String, default: '' },
      foodHygieneExpiryDate: { type: Date },
      cacUrl: { type: String, default: '' },
      cacExpiryDate: { type: Date },
      idNumber: { type: String, default: '' },
      isDocumentExpired: { type: Boolean, default: false },
      expiredDocuments: { type: [String], default: [] },
    },
    ninUrl: {
      type: String,
      default: '',
    },
    ninExpiryDate: {
      type: Date,
    },
    foodHygieneUrl: {
      type: String,
      default: '',
    },
    foodHygieneExpiryDate: {
      type: Date,
    },
    cacUrl: {
      type: String,
      default: '',
    },
    cacExpiryDate: {
      type: Date,
    },
    isDocumentExpired: {
      type: Boolean,
      default: false,
    },
    expiredDocuments: {
      type: [String],
      default: [],
    },
    businessImageUrl: {
      type: String,
      default: '',
    },
    coverImageUrl: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected', 'declined'],
      default: 'pending',
      index: true,
    },
    adminNotes: {
      type: String,
      default: '',
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    onboardedRestaurant: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
    },
    claimCode: {
      type: String,
      trim: true,
      index: true,
    },
    claimCodeExpiresAt: {
      type: Date,
    },
    isClaimed: {
      type: Boolean,
      default: false,
      index: true,
    },
    claimedAt: {
      type: Date,
    },
    optOutToken: {
      type: String,
      trim: true,
      index: true,
    },
    optedOutAt: {
      type: Date,
    },
    optOutReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

partnerApplicationSchema.index({ createdAt: -1 });

const PartnerApplication = mongoose.model<IPartnerApplication>(
  'PartnerApplication',
  partnerApplicationSchema
);

export default PartnerApplication;
