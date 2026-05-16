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
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true,
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
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
        type: Number, // in minutes
        default: 30,
    },
    isSelfPickup: {
        type: Boolean,
        default: true,
    },
    status: {
        type: String,
        enum: Object.values(RestaurantStatus),
        default: RestaurantStatus.PENDING,
    },
}, {
    timestamps: true,
});
// Index for geospatial queries
restaurantSchema.index({ location: '2dsphere' });
const Restaurant = mongoose_1.default.model('Restaurant', restaurantSchema);
exports.default = Restaurant;
