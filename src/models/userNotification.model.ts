import mongoose, { Schema, Document } from 'mongoose';

/**
 * Per-user in-app notification (order updates, promotions, system alerts).
 * Each document represents one notification delivered to one user.
 */

export enum NotificationType {
  ORDER_UPDATE = 'order_update',
  NEW_ORDER = 'new_order',
  PROMOTION = 'promotion',
  SYSTEM = 'system',
}

export interface IUserNotification extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  body: string;
  type: NotificationType;
  isRead: boolean;
  orderId?: mongoose.Types.ObjectId;
  data?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const userNotificationSchema = new Schema<IUserNotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification must belong to a user'],
      index: true,
    },
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
    type: {
      type: String,
      enum: Object.values(NotificationType),
      default: NotificationType.SYSTEM,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    data: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast "get my unread notifications" queries
userNotificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const UserNotification = mongoose.model<IUserNotification>('UserNotification', userNotificationSchema);

export default UserNotification;
