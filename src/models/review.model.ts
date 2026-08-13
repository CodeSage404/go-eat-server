import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
  user: mongoose.Types.ObjectId;
  restaurant: mongoose.Types.ObjectId;
  order: mongoose.Types.ObjectId;
  rating: number;
  comment?: string;
  vendorReply?: string;
  vendorReplyDate?: Date;
  createdAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Review must belong to a restaurant'],
    },
    order: {
      type: Schema.Types.ObjectId,
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
    vendorReply: {
      type: String,
      trim: true,
    },
    vendorReplyDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate average rating for restaurant after saving review
reviewSchema.statics.calcAverageRating = async function (restaurantId: mongoose.Types.ObjectId) {
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
    await mongoose.model('Restaurant').findByIdAndUpdate(restaurantId, {
      ratingsAverage: Math.round(stats[0].avgRating * 10) / 10,
      ratingsQuantity: stats[0].nRating,
    });
  }
};

reviewSchema.post('save', function () {
  (this.constructor as any).calcAverageRating(this.restaurant);
});

const Review = mongoose.model<IReview>('Review', reviewSchema);

export default Review;
