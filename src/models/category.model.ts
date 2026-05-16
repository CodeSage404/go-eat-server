import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  restaurant: mongoose.Types.ObjectId;
  description?: string;
  order: number; // For sorting categories in the menu
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
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Category must belong to a restaurant'],
    },
    description: {
      type: String,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure category names are unique per restaurant
categorySchema.index({ name: 1, restaurant: 1 }, { unique: true });

const Category = mongoose.model<ICategory>('Category', categorySchema);

export default Category;
