import mongoose, { Schema, Document } from 'mongoose';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

export interface IBooking extends Document {
  customer: mongoose.Types.ObjectId;
  restaurant: mongoose.Types.ObjectId;
  bookingDate: Date;
  bookingTime: string; // e.g. "08:00 AM" or "12:00 PM"
  numberOfGuests: number;
  status: BookingStatus;
  specialRequests?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Booking must belong to a customer'],
    },
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Booking must belong to a restaurant'],
    },
    bookingDate: {
      type: Date,
      required: [true, 'Booking date is required'],
    },
    bookingTime: {
      type: String,
      required: [true, 'Booking time slot is required'],
    },
    numberOfGuests: {
      type: Number,
      default: 2,
      min: 1,
    },
    status: {
      type: String,
      enum: Object.values(BookingStatus),
      default: BookingStatus.PENDING,
    },
    specialRequests: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Booking = mongoose.model<IBooking>('Booking', bookingSchema);

export default Booking;
