import mongoose, { Schema, Document } from 'mongoose';

export interface IFoodItem extends Document {
  name: string;
  description: string;
  price: number;
  image: string;
  category: mongoose.Types.ObjectId;
  restaurant: mongoose.Types.ObjectId;
  isAvailable: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  isSpicy: boolean;
  isGlutenFree: boolean;
  isHalal: boolean;
  calories?: number;
  preparationTime?: number;
  allergens?: string[];
  discountPercentage?: number;
  originalPrice?: number;
  createdAt: Date;
  updatedAt: Date;
}

const foodItemSchema = new Schema<IFoodItem>(
  {
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
    originalPrice: {
      type: Number,
      default: null,
    },
    discountPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    image: {
      type: String,
      default: 'default-food.png',
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Food item must belong to a category'],
    },
    restaurant: {
      type: Schema.Types.ObjectId,
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
    isVegan: {
      type: Boolean,
      default: false,
    },
    isSpicy: {
      type: Boolean,
      default: false,
    },
    isGlutenFree: {
      type: Boolean,
      default: false,
    },
    isHalal: {
      type: Boolean,
      default: false,
    },
    calories: {
      type: Number,
    },
    preparationTime: {
      type: Number,
      default: 20,
    },
    allergens: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const FoodItem = mongoose.model<IFoodItem>('FoodItem', foodItemSchema);

export default FoodItem;
