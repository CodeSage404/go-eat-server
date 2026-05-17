import mongoose, { Schema, Document } from 'mongoose';

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum TicketCategory {
  MISSING_ITEM = 'missing_item',
  COLD_FOOD = 'cold_food',
  LATE_DELIVERY = 'late_delivery',
  RIDER_BEHAVIOR = 'rider_behavior',
  PAYMENT_ISSUE = 'payment_issue',
  OTHER = 'other',
}

export interface ITicket extends Document {
  customer: mongoose.Types.ObjectId;
  order?: mongoose.Types.ObjectId;
  restaurant?: mongoose.Types.ObjectId;
  category: TicketCategory;
  subject: string;
  description: string;
  status: TicketStatus;
  adminResponse?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<ITicket>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
    },
    category: {
      type: String,
      enum: Object.values(TicketCategory),
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TicketStatus),
      default: TicketStatus.OPEN,
    },
    adminResponse: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Ticket = mongoose.model<ITicket>('Ticket', ticketSchema);

export default Ticket;
