import mongoose, { Schema, Document } from 'mongoose';

export interface IComboOption {
  _id?: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
}

export interface IOptionItem {
  _id?: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
  isDefault?: boolean;
}

export interface IOptionGroup {
  _id?: string;
  name: string;
  required: boolean;
  selectionType: 'single' | 'multiple';
  minSelections?: number;
  maxSelections?: number;
  options: IOptionItem[];
}

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
  spiceLevel?: number; // 0 = None, 1 = Mild (🌶️), 2 = Extra Hot (🌶️🌶️), 3 = Fire (🔥)
  isGlutenFree: boolean;
  isHalal: boolean;
  isCombo?: boolean;
  comboRequired?: boolean;
  comboOptions?: IComboOption[];
  optionGroups?: IOptionGroup[];
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
    spiceLevel: {
      type: Number,
      enum: [0, 1, 2, 3],
      default: 0,
    },
    isGlutenFree: {
      type: Boolean,
      default: false,
    },
    isHalal: {
      type: Boolean,
      default: false,
    },
    isCombo: {
      type: Boolean,
      default: false,
    },
    comboRequired: {
      type: Boolean,
      default: false,
    },
    comboOptions: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true },
        description: { type: String },
        image: { type: String },
      },
    ],
    optionGroups: [
      {
        name: { type: String, required: true },
        required: { type: Boolean, default: false },
        selectionType: { type: String, enum: ['single', 'multiple'], default: 'single' },
        minSelections: { type: Number, default: 0 },
        maxSelections: { type: Number },
        options: [
          {
            name: { type: String, required: true },
            price: { type: Number, default: 0 },
            description: { type: String },
            image: { type: String },
            isDefault: { type: Boolean, default: false },
          },
        ],
      },
    ],
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
