import mongoose, { Schema, Document } from 'mongoose';

export type CustomMealRequestStatus = 'pending' | 'priced' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

export interface ICustomMealQuote {
  itemName: string;
  price: number;
  deliveryFee: number;
  total: number;
  chefMessage?: string;
  quotedAt: Date;
}

export interface ICustomMealRequest extends Document {
  customer: mongoose.Types.ObjectId;
  restaurant: mongoose.Types.ObjectId;
  requestText: string;
  photos?: string[];
  specialNotes?: string;
  status: CustomMealRequestStatus;
  quote?: ICustomMealQuote;
  order?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customMealRequestSchema = new Schema<ICustomMealRequest>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer is required'],
      index: true,
    },
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant/Chef is required'],
      index: true,
    },
    requestText: {
      type: String,
      required: [true, 'Request text is required'],
      trim: true,
    },
    photos: {
      type: [String],
      default: [],
    },
    specialNotes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'priced', 'accepted', 'rejected', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    quote: {
      itemName: { type: String, trim: true },
      price: { type: Number },
      deliveryFee: { type: Number },
      total: { type: Number },
      chefMessage: { type: String, trim: true },
      quotedAt: { type: Date },
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
  },
  {
    timestamps: true,
  }
);

customMealRequestSchema.index({ restaurant: 1, status: 1 });
customMealRequestSchema.index({ customer: 1, createdAt: -1 });

const CustomMealRequest = mongoose.model<ICustomMealRequest>('CustomMealRequest', customMealRequestSchema);

export default CustomMealRequest;
