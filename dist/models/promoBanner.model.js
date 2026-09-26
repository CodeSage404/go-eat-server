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
const mongoose_1 = __importStar(require("mongoose"));
const promoBannerSchema = new mongoose_1.Schema({
    isActive: {
        type: Boolean,
        default: true,
    },
    isCarouselEnabled: {
        type: Boolean,
        default: true,
    },
    topSpotsTitle: {
        type: String,
        default: 'Neighborhood Favorites',
        trim: true,
    },
    offersTitle: {
        type: String,
        default: 'Tasty Offers',
        trim: true,
    },
    offersSubtitle: {
        type: String,
        default: 'Tailored to your taste buds',
        trim: true,
    },
    headline: {
        type: String,
        default: 'Save ₦3,000',
        trim: true,
    },
    subtitle: {
        type: String,
        default: 'Enjoy ₦1,000 off your first three orders. Min. spend applies. T&Cs apply.',
        trim: true,
    },
    ctaText: {
        type: String,
        default: 'Order now',
        trim: true,
    },
    ctaLink: {
        type: String,
        default: '/voucher',
        trim: true,
    },
    voucherText: {
        type: String,
        default: '₦1,000 off',
        trim: true,
    },
    imageUrl: {
        type: String,
        default: '',
        trim: true,
    },
    bannerType: {
        type: String,
        enum: ['side', 'background'],
        default: 'side',
    },
    backgroundColor: {
        type: String,
        default: '#F5B743',
        trim: true,
    },
    backgroundColorDark: {
        type: String,
        default: '#D99B26',
        trim: true,
    },
    slides: [
        {
            isActive: { type: Boolean, default: true },
            headline: { type: String, trim: true },
            subtitle: { type: String, trim: true },
            ctaText: { type: String, trim: true },
            ctaLink: { type: String, trim: true },
            voucherText: { type: String, trim: true },
            imageUrl: { type: String, default: '', trim: true },
            bannerType: { type: String, enum: ['side', 'background'], default: 'side' },
            backgroundColor: { type: String, trim: true },
            backgroundColorDark: { type: String, trim: true },
            code: { type: String, trim: true },
        },
    ],
}, {
    timestamps: true,
});
const PromoBanner = mongoose_1.default.model('PromoBanner', promoBannerSchema);
exports.default = PromoBanner;
