import mongoose, { Schema, Document } from 'mongoose';

export type SellingModel = 'FOOD_MENU' | 'RETAIL_PRODUCT';

export interface ICategory extends Document {
  name: string;
  slug?: string;
  image?: string;
  icon?: string;
  restaurant?: mongoose.Types.ObjectId;
  description?: string;
  order: number;
  sortOrder?: number;
  isGlobal?: boolean;
  isActive?: boolean;
  systemCode?: string;
  sellingModel?: SellingModel;
  parentId?: mongoose.Types.ObjectId | null;
  isSystemPermanent?: boolean;
  country?: string;
  countryCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    image: {
      type: String,
      trim: true,
    },
    icon: {
      type: String,
      trim: true,
    },
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: false,
    },
    description: {
      type: String,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    systemCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    sellingModel: {
      type: String,
      enum: ['FOOD_MENU', 'RETAIL_PRODUCT'],
      default: 'FOOD_MENU',
      index: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    isSystemPermanent: {
      type: Boolean,
      default: false,
      index: true,
    },
    isGlobal: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    country: {
      type: String,
      index: true,
    },
    countryCode: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast search
categorySchema.index({ name: 1, isGlobal: 1 });
categorySchema.index({ systemCode: 1 }, { unique: false, sparse: true });
categorySchema.index({ parentId: 1 });

const Category = mongoose.model<ICategory>('Category', categorySchema);

export default Category;
