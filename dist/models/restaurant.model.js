"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestaurantStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var RestaurantStatus;
(function (RestaurantStatus) {
    RestaurantStatus["ACTIVE"] = "active";
    RestaurantStatus["INACTIVE"] = "inactive";
    RestaurantStatus["PENDING"] = "pending";
    RestaurantStatus["SUSPENDED"] = "suspended";
})(RestaurantStatus || (exports.RestaurantStatus = RestaurantStatus = {}));
const restaurantSchema = new mongoose_1.Schema({
    owner: {
        type: mongoose_1.Schema.Types.ObjectId,
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
        country: { type: String },
        countryCode: { type: String },
    },
    country: {
        type: String,
        default: 'Nigeria',
        index: true,
    },
    countryCode: {
        type: String,
        default: 'NG',
        index: true,
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
    paystackSubaccountCode: {
        type: String,
        trim: true,
    },
    bankDetails: {
        bankName: { type: String },
        bankCode: { type: String },
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
    autoAcceptOrders: {
        type: Boolean,
        default: false,
    },
    orderAlerts: {
        type: Boolean,
        default: true,
    },
    specialDays: [
        {
            name: { type: String, required: true },
            date: { type: String, required: true },
            description: { type: String },
            isClosed: { type: Boolean, default: false },
            open: { type: String },
            close: { type: String },
        }
    ],
    hygieneRating: {
        type: Number,
        min: 0,
        max: 5,
        default: 5,
    },
    hygieneRatedAt: {
        type: Date,
        default: Date.now,
    },
    hygieneNotes: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
});
// Auto-derive country & countryCode if not set or ambiguous
restaurantSchema.pre('save', function () {
    const rest = this;
    const rawAddr = `${rest.address?.street || ''} ${rest.address?.city || ''} ${rest.address?.state || ''} ${rest.address?.country || ''}`.toLowerCase();
    const coords = rest.location?.coordinates;
    const lng = coords && Array.isArray(coords) ? coords[0] : 0;
    const lat = coords && Array.isArray(coords) ? coords[1] : 0;
    if (!rest.country || (rest.country === 'Nigeria' && rest.countryCode === 'NG')) {
        if (rawAddr.includes('united kingdom') ||
            rawAddr.includes('london') ||
            rawAddr.includes('england') ||
            rawAddr.includes('uk') ||
            rawAddr.includes('scotland') ||
            rawAddr.includes('wales') ||
            (lat >= 49.5 && lat <= 61.0 && lng >= -8.5 && lng <= 2.0)) {
            rest.country = 'United Kingdom';
            rest.countryCode = 'GB';
            rest.isUk = true;
            rest.isNigeria = false;
            rest.isItaly = false;
        }
        else if (rawAddr.includes('italy') ||
            rawAddr.includes('italia') ||
            rawAddr.includes('rome') ||
            rawAddr.includes('roma') ||
            rawAddr.includes('milan') ||
            (lat >= 36.0 && lat <= 47.5 && lng >= 6.5 && lng <= 18.5)) {
            rest.country = 'Italy';
            rest.countryCode = 'IT';
            rest.isItaly = true;
            rest.isNigeria = false;
            rest.isUk = false;
        }
        else {
            rest.country = 'Nigeria';
            rest.countryCode = 'NG';
            rest.isNigeria = true;
            rest.isItaly = false;
            rest.isUk = false;
        }
    }
    if (rest.address) {
        rest.address.country = rest.country;
        rest.address.countryCode = rest.countryCode;
    }
});
// Indexes for geospatial and country queries
restaurantSchema.index({ location: '2dsphere' });
restaurantSchema.index({ country: 1, status: 1 });
restaurantSchema.index({ countryCode: 1, status: 1 });
const Restaurant = mongoose_1.default.model('Restaurant', restaurantSchema);
exports.default = Restaurant;
