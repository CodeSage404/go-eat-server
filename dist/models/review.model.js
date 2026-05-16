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
const reviewSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Review must belong to a user'],
    },
    restaurant: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: [true, 'Review must belong to a restaurant'],
    },
    order: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Order',
        required: [true, 'Review must belong to an order'],
        unique: true, // One review per order
    },
    rating: {
        type: Number,
        required: [true, 'Please provide a rating'],
        min: 1,
        max: 5,
    },
    comment: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
});
// Calculate average rating for restaurant after saving review
reviewSchema.statics.calcAverageRating = async function (restaurantId) {
    const stats = await this.aggregate([
        { $match: { restaurant: restaurantId } },
        {
            $group: {
                _id: '$restaurant',
                nRating: { $sum: 1 },
                avgRating: { $avg: '$rating' },
            },
        },
    ]);
    if (stats.length > 0) {
        await mongoose_1.default.model('Restaurant').findByIdAndUpdate(restaurantId, {
            ratingsAverage: Math.round(stats[0].avgRating * 10) / 10,
            ratingsQuantity: stats[0].nRating,
        });
    }
};
reviewSchema.post('save', function () {
    this.constructor.calcAverageRating(this.restaurant);
});
const Review = mongoose_1.default.model('Review', reviewSchema);
exports.default = Review;
