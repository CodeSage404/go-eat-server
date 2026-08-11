import mongoose, { Schema, Document } from 'mongoose';

export enum RestaurantStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

export interface IRestaurant extends Document {
  owner: mongoose.Types.ObjectId;
  name: string;
  description: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  location: {
    type: 'Point';
    coordinates: [number, number]; 
  };
  cuisine: string[];
  rating: number;
  numReviews: number;
  openingHours: {
    Monday: { isOpen: boolean; open: string; close: string; };
    Tuesday: { isOpen: boolean; open: string; close: string; };
    Wednesday: { isOpen: boolean; open: string; close: string; };
    Thursday: { isOpen: boolean; open: string; close: string; };
    Friday: { isOpen: boolean; open: string; close: string; };
    Saturday: { isOpen: boolean; open: string; close: string; };
    Sunday: { isOpen: boolean; open: string; close: string; };
  };
  images: {
    logo: string;
    cover: string;
  };
  deliveryFee: number;
  minOrderAmount: number;
  estimatedDeliveryTime: number; // in minutes
  isSelfPickup: boolean;
  allowsGroupOrder: boolean;
  hasFreeDelivery: boolean;
  allowStampCards: boolean;
  allowFreeGift: boolean;
  hasPromo: boolean;
  acceptsPromos: boolean;
  promoText?: string;
  isTopSpot: boolean;
  isSponsored: boolean;
  popularityScore: number;
  status: RestaurantStatus;
  outletType: 'Restaurant' | 'Smokey Wheel' | 'Grocery' | 'Specialty Store' | 'Health & Wellness' | 'Convenience' | 'Lifestyle';
  tradingName?: string;
  businessCategory?: string;
  lga?: string;
  deliveryRadius?: number; // in kilometers
  businessPhone?: string;
  businessEmail?: string;
  businessWebsite?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    bvn?: string;
    isVerified: boolean;
  };
  ninVerification?: {
    nin: string;
    verifiedName?: string;
    dob?: string;
    identityStatus?: 'pending' | 'verified' | 'failed';
    selfieUrl?: string;
  };
  cacRegistration?: {
    isRegisteredBusiness: boolean;
    cacNumber?: string;
    cacCertificateUrl?: string;
  };
  complianceStatus?: 'pending' | 'approved' | 'rejected' | 'expired';
  baseCurrency: string;
  createdAt: Date;
  updatedAt: Date;
}

const restaurantSchema = new Schema<IRestaurant>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Restaurant must have an owner'],
    },
    name: {
      type: String,
      required: [true, 'Restaurant name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Restaurant description is required'],
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    cuisine: {
      type: [String],
      default: [],
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    numReviews: {
      type: Number,
      default: 0,
    },
    openingHours: {
      Monday: { isOpen: { type: Boolean, default: true }, open: { type: String, default: '08:00 AM' }, close: { type: String, default: '06:00 PM' } },
      Tuesday: { isOpen: { type: Boolean, default: true }, open: { type: String, default: '08:00 AM' }, close: { type: String, default: '06:00 PM' } },
      Wednesday: { isOpen: { type: Boolean, default: true }, open: { type: String, default: '08:00 AM' }, close: { type: String, default: '06:00 PM' } },
      Thursday: { isOpen: { type: Boolean, default: true }, open: { type: String, default: '08:00 AM' }, close: { type: String, default: '06:00 PM' } },
      Friday: { isOpen: { type: Boolean, default: true }, open: { type: String, default: '08:00 AM' }, close: { type: String, default: '06:00 PM' } },
      Saturday: { isOpen: { type: Boolean, default: true }, open: { type: String, default: '08:00 AM' }, close: { type: String, default: '06:00 PM' } },
      Sunday: { isOpen: { type: Boolean, default: false }, open: { type: String, default: '08:00 AM' }, close: { type: String, default: '06:00 PM' } },
    },
    images: {
      logo: { type: String, default: 'default-logo.png' },
      cover: { type: String, default: 'default-cover.png' },
    },
    deliveryFee: {
      type: Number,
      default: 0,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
    },
    estimatedDeliveryTime: {
      type: Number,
      default: 30,
    },
    isSelfPickup: {
      type: Boolean,
      default: true,
    },
    allowsGroupOrder: {
      type: Boolean,
      default: false,
    },
    hasFreeDelivery: {
      type: Boolean,
      default: false,
    },
    allowStampCards: {
      type: Boolean,
      default: false,
    },
    allowFreeGift: {
      type: Boolean,
      default: false,
    },
    hasPromo: {
      type: Boolean,
      default: false,
    },
    acceptsPromos: {
      type: Boolean,
      default: false,
    },
    promoText: {
      type: String,
      default: '',
    },
    isTopSpot: {
      type: Boolean,
      default: false,
    },
    isSponsored: {
      type: Boolean,
      default: false,
    },
    popularityScore: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(RestaurantStatus),
      default: RestaurantStatus.PENDING,
    },
    outletType: {
      type: String,
      enum: ['Restaurant', 'Smokey Wheel', 'Grocery', 'Specialty Store', 'Health & Wellness', 'Convenience', 'Lifestyle'],
      default: 'Restaurant',
    },
    tradingName: {
      type: String,
      trim: true,
    },
    businessCategory: {
      type: String,
      trim: true,
    },
    lga: {
      type: String,
      trim: true,
    },
    deliveryRadius: {
      type: Number,
      default: 5,
    },
    businessPhone: {
      type: String,
      trim: true,
    },
    businessEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    businessWebsite: {
      type: String,
      trim: true,
    },
    bankDetails: {
      bankName: { type: String },
      accountNumber: { type: String },
      accountName: { type: String },
      bvn: { type: String },
      isVerified: { type: Boolean, default: false },
    },
    ninVerification: {
      nin: { type: String },
      verifiedName: { type: String },
      dob: { type: String },
      identityStatus: {
        type: String,
        enum: ['pending', 'verified', 'failed'],
        default: 'pending',
      },
      selfieUrl: { type: String },
    },
    cacRegistration: {
      isRegisteredBusiness: { type: Boolean, default: false },
      cacNumber: { type: String },
      cacCertificateUrl: { type: String },
    },
    complianceStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending',
    },
    baseCurrency: {
      type: String,
      default: 'NGN',
    },
  },
  {
    timestamps: true,
  }
);

// Index for geospatial queries
restaurantSchema.index({ location: '2dsphere' });

const Restaurant = mongoose.model<IRestaurant>('Restaurant', restaurantSchema);

export default Restaurant;
