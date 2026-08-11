import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export enum UserRole {
  CUSTOMER = 'customer',
  VENDOR = 'vendor',
  RIDER = 'rider',
  ADMIN = 'admin',
  STAFF = 'staff',
}

export enum UserStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  status: UserStatus;
  phoneNumber?: string;
  customRole?: string;
  restaurantId?: mongoose.Types.ObjectId;
  profileImage?: string;
  fcmToken?: string;
  notificationsEnabled: boolean;
  googleId?: string;
  appleId?: string;
  isVerified: boolean;
  isOnline: boolean;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  savedAddresses: Array<{
    label: string;
    address: string;
    location: {
      type: 'Point';
      coordinates: [number, number];
    };
    isDefault: boolean;
  }>;
  favorites: mongoose.Types.ObjectId[];
  referralCode: string;
  referredBy?: mongoose.Types.ObjectId;
  referralCount: number;
  referralEarnings: number;
  country: string;
  countryCode?: string;
  isNigeria: boolean;
  isItaly: boolean;
  isUk: boolean;
  adminRegion?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 8,
      select: false, // Don't return password by default
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CUSTOMER,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
    },
    phoneNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    customRole: {
      type: String,
      lowercase: true,
      trim: true,
    },
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
    },
    profileImage: {
      type: String,
      default: 'default-profile.png',
    },
    fcmToken: {
      type: String,
      trim: true,
    },
    notificationsEnabled: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    appleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
      },
    },
    savedAddresses: [
      {
        label: { type: String, required: true }, // e.g., 'Home', 'Work'
        address: { type: String, required: true },
        location: {
          type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
          },
          coordinates: [Number],
        },
        isDefault: { type: Boolean, default: false },
      },
    ],
    favorites: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Restaurant',
      },
    ],
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    referralCount: {
      type: Number,
      default: 0,
    },
    referralEarnings: {
      type: Number,
      default: 0,
    },
    country: {
      type: String,
      enum: ['Nigeria', 'Italy', 'UK', 'Other'],
      default: 'Nigeria',
    },
    countryCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    isNigeria: {
      type: Boolean,
      default: true,
    },
    isItaly: {
      type: Boolean,
      default: false,
    },
    isUk: {
      type: Boolean,
      default: false,
    },
    adminRegion: {
      type: String,
      enum: ['ALL', 'Nigeria', 'Italy', 'UK'],
      default: 'ALL',
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving + generate referralCode + sync regional booleans
userSchema.pre('save', async function () {
  if (this.country) {
    this.isNigeria = (this.country === 'Nigeria');
    this.isItaly = (this.country === 'Italy');
    this.isUk = (this.country === 'UK');
  }
  if (!this.referralCode) {
    this.referralCode = `GE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password!, 10);
});

// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password!);
};

// Indexes for fast lookup, regional filtering, & geospatial queries
userSchema.index({ location: '2dsphere' });
userSchema.index({ country: 1 });
userSchema.index({ isNigeria: 1 });
userSchema.index({ isItaly: 1 });
userSchema.index({ isUk: 1 });

const User = mongoose.model<IUser>('User', userSchema);

export default User;
