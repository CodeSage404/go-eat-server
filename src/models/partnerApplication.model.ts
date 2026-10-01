import mongoose, { Schema, Document } from 'mongoose';

export type PartnerApplicationStatus = 'pending' | 'under_review' | 'approved' | 'rejected';

export interface IPartnerDocuments {
  ninUrl?: string;
  foodHygieneUrl?: string;
  cacUrl?: string;
  idNumber?: string;
}

export interface IPartnerApplication extends Document {
  businessName: string;
  businessAddress: string;
  businessType: string;
  ownerName: string;
  email: string;
  phoneNumber: string;
  city?: string;
  documents?: IPartnerDocuments;
  ninUrl?: string;
  foodHygieneUrl?: string;
  cacUrl?: string;
  status: PartnerApplicationStatus;
  adminNotes?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  onboardedRestaurant?: mongoose.Types.ObjectId;
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
    documents: {
      ninUrl: { type: String, default: '' },
      foodHygieneUrl: { type: String, default: '' },
      cacUrl: { type: String, default: '' },
      idNumber: { type: String, default: '' },
    },
    ninUrl: {
      type: String,
      default: '',
    },
    foodHygieneUrl: {
      type: String,
      default: '',
    },
    cacUrl: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected'],
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
