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
    open: string; 
    close: string; 
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
  isTopSpot: boolean;
  popularityScore: number;
  status: RestaurantStatus;
  outletType: 'Restaurant' | 'Pharmacy' | 'Convenience' | 'Grocery';
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
      open: { type: String, required: true },
      close: { type: String, required: true },
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
    isTopSpot: {
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
      enum: ['Restaurant', 'Pharmacy', 'Convenience', 'Grocery'],
      default: 'Restaurant',
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
