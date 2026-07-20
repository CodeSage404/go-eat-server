import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  slug?: string;
  image?: string;
  icon?: string;
  restaurant?: mongoose.Types.ObjectId;
  description?: string;
  order: number;
  isGlobal?: boolean;
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
    isGlobal: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast search
categorySchema.index({ name: 1, isGlobal: 1 });

const Category = mongoose.model<ICategory>('Category', categorySchema);

export default Category;
