import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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
  hasChangedPassword?: boolean;
  passwordChangedAt?: Date;
  lastLoginAt?: Date;
  lastActiveAt?: Date;
  lastLoginDevice?: {
    deviceId?: string;
    deviceName?: string;
    platform?: string;
    userAgent?: string;
    ipAddress?: string;
    loggedInAt: Date;
  };
  knownDevices?: Array<{
    deviceId?: string;
    deviceName?: string;
    platform?: string;
    userAgent?: string;
    ipAddress?: string;
    firstSeenAt: Date;
    lastSeenAt: Date;
  }>;
  lastInactivityAlertAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
  hasChangedPasswordAfter?(jwtTimestamp: number): boolean;
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
    hasChangedPassword: {
      type: Boolean,
      default: false,
    },
    passwordChangedAt: {
      type: Date,
    },
    lastLoginAt: {
      type: Date,
    },
    lastActiveAt: {
      type: Date,
    },
    lastLoginDevice: {
      deviceId: { type: String, trim: true },
      deviceName: { type: String, trim: true },
      platform: { type: String, trim: true },
      userAgent: { type: String, trim: true },
      ipAddress: { type: String, trim: true },
      loggedInAt: { type: Date },
    },
    knownDevices: [
      {
        deviceId: { type: String, trim: true },
        deviceName: { type: String, trim: true },
        platform: { type: String, trim: true },
        userAgent: { type: String, trim: true },
        ipAddress: { type: String, trim: true },
        firstSeenAt: { type: Date, default: Date.now },
        lastSeenAt: { type: Date, default: Date.now },
      },
    ],
    lastInactivityAlertAt: {
      type: Date,
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
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    this.referralCode = `GE-${randomHex}`;
  }
  if (!this.isModified('password') || !this.password) return;

  // 12 rounds bcrypt hash for hardened security
  this.password = await bcrypt.hash(this.password, 12);

  if (!this.isNew) {
    this.passwordChangedAt = new Date(Date.now() - 1000);
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password!);
};

// Check if user changed password after JWT was issued
userSchema.methods.hasChangedPasswordAfter = function (jwtTimestamp: number): boolean {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt((this.passwordChangedAt.getTime() / 1000).toString(), 10);
    return jwtTimestamp < changedTimestamp;
  }
  return false;
};

// Indexes for fast lookup, regional filtering, & geospatial queries
userSchema.index({ location: '2dsphere' });
userSchema.index({ country: 1 });
userSchema.index({ isNigeria: 1 });
userSchema.index({ isItaly: 1 });
userSchema.index({ isUk: 1 });
userSchema.index({ lastActiveAt: 1 });
userSchema.index({ lastInactivityAlertAt: 1 });

const User = mongoose.model<IUser>('User', userSchema);

export default User;
