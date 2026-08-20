import mongoose, { Schema, Document } from 'mongoose';

export enum OrderStatus {
  PAYMENT_PENDING = 'payment_pending',
  PAID = 'paid',
  SENT_TO_OUTLET = 'sent_to_outlet',
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  PREPARING = 'preparing',
  READY_FOR_COLLECTION = 'ready_for_collection',
  READY = 'ready',
  COURIER_ASSIGNED = 'courier_assigned',
  COURIER_COLLECTED = 'courier_collected',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  SETTLEMENT_AVAILABLE = 'settlement_available',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  CANCELLED_BY_CUSTOMER = 'cancelled_by_customer',
  CANCELLED_BY_OUTLET = 'cancelled_by_outlet',
  CANCELLED_BY_GOEAT = 'cancelled_by_goeat',
  COURIER_REASSIGNMENT = 'courier_reassignment',
  REFUND_PENDING = 'refund_pending',
  PARTIALLY_REFUNDED = 'partially_refunded',
  FULLY_REFUNDED = 'fully_refunded',
  PAYMENT_DISPUTED = 'payment_disputed',
  SETTLEMENT_ON_HOLD = 'settlement_on_hold',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
}

export interface IOrderItem {
  foodItem: mongoose.Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
}

export interface IOrder extends Document {
  customer: mongoose.Types.ObjectId;
  restaurant: mongoose.Types.ObjectId;
  rider?: mongoose.Types.ObjectId;
  items: IOrderItem[];
  totalAmount: number;
  grossAmount?: number;
  commissionRate?: number; // e.g. 0.15 for 15%
  commissionAmount?: number; // e.g. 1500
  outletNetSettlement?: number; // e.g. 8500
  courierEarnings?: number;
  deliveryFee: number;
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    coordinates: [number, number]; // [lng, lat]
  };
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'completed' | 'failed';
  paymentResult?: {
    id: string;
    status: string;
    update_time: string;
    email_address: string;
  };
  status: OrderStatus;
  estimatedPrepTime?: number; // In minutes
  estimatedDeliveryTime?: Date;
  deliveryInstructions?: string;
  cancellationInitiator?: 'customer' | 'outlet' | 'courier' | 'goeat';
  cancelReason?: string;
  refundAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Order must belong to a customer'],
    },
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Order must belong to a restaurant'],
    },
    rider: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    items: [
      {
        foodItem: { type: Schema.Types.ObjectId, ref: 'FoodItem', required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    grossAmount: {
      type: Number,
      default: 0,
    },
    commissionRate: {
      type: Number,
      default: 0.15, // Default 15% platform commission
    },
    commissionAmount: {
      type: Number,
      default: 0,
    },
    outletNetSettlement: {
      type: Number,
      default: 0,
    },
    courierEarnings: {
      type: Number,
      default: 0,
    },
    deliveryFee: {
      type: Number,
      default: 0,
    },
    deliveryAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      default: PaymentMethod.CARD,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    paymentResult: {
      id: { type: String },
      status: { type: String },
      update_time: { type: String },
      email_address: { type: String },
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
    },
    estimatedPrepTime: {
      type: Number,
      default: 20,
    },
    estimatedDeliveryTime: {
      type: Date,
    },
    deliveryInstructions: {
      type: String,
      trim: true,
    },
    cancellationInitiator: {
      type: String,
      enum: ['customer', 'outlet', 'courier', 'goeat'],
    },
    cancelReason: {
      type: String,
      trim: true,
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model<IOrder>('Order', orderSchema);

export default Order;
