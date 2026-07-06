import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  title: string;
  body: string;
  targetRole: 'all' | 'customer' | 'vendor' | 'rider';
  sentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    body: {
      type: String,
      required: [true, 'Notification body is required'],
      trim: true,
    },
    targetRole: {
      type: String,
      enum: ['all', 'customer', 'vendor', 'rider'],
      default: 'all',
    },
    sentCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model<INotification>('Notification', notificationSchema);

export default Notification;
