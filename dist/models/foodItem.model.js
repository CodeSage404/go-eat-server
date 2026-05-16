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
const foodItemSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: [true, 'Food item name is required'],
        trim: true,
    },
    description: {
        type: String,
        required: [true, 'Food item description is required'],
    },
    price: {
        type: Number,
        required: [true, 'Food item price is required'],
    },
    image: {
        type: String,
        default: 'default-food.png',
    },
    category: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Food item must belong to a category'],
    },
    restaurant: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: [true, 'Food item must belong to a restaurant'],
    },
    isAvailable: {
        type: Boolean,
        default: true,
    },
    isVegetarian: {
        type: Boolean,
        default: false,
    },
    isSpicy: {
        type: Boolean,
        default: false,
    },
    calories: {
        type: Number,
    },
}, {
    timestamps: true,
});
const FoodItem = mongoose_1.default.model('FoodItem', foodItemSchema);
exports.default = FoodItem;
