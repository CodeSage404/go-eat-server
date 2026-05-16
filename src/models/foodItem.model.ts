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
  isSpicy: boolean;
  calories?: number;
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
    isSpicy: {
      type: Boolean,
      default: false,
    },
    calories: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

const FoodItem = mongoose.model<IFoodItem>('FoodItem', foodItemSchema);

export default FoodItem;
