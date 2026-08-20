"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentMethod = exports.OrderStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PAYMENT_PENDING"] = "payment_pending";
    OrderStatus["PAID"] = "paid";
    OrderStatus["SENT_TO_OUTLET"] = "sent_to_outlet";
    OrderStatus["PENDING"] = "pending";
    OrderStatus["ACCEPTED"] = "accepted";
    OrderStatus["PREPARING"] = "preparing";
    OrderStatus["READY_FOR_COLLECTION"] = "ready_for_collection";
    OrderStatus["READY"] = "ready";
    OrderStatus["COURIER_ASSIGNED"] = "courier_assigned";
    OrderStatus["COURIER_COLLECTED"] = "courier_collected";
    OrderStatus["OUT_FOR_DELIVERY"] = "out_for_delivery";
    OrderStatus["DELIVERED"] = "delivered";
    OrderStatus["COMPLETED"] = "completed";
    OrderStatus["SETTLEMENT_AVAILABLE"] = "settlement_available";
    OrderStatus["REJECTED"] = "rejected";
    OrderStatus["CANCELLED"] = "cancelled";
    OrderStatus["CANCELLED_BY_CUSTOMER"] = "cancelled_by_customer";
    OrderStatus["CANCELLED_BY_OUTLET"] = "cancelled_by_outlet";
    OrderStatus["CANCELLED_BY_GOEAT"] = "cancelled_by_goeat";
    OrderStatus["COURIER_REASSIGNMENT"] = "courier_reassignment";
    OrderStatus["REFUND_PENDING"] = "refund_pending";
    OrderStatus["PARTIALLY_REFUNDED"] = "partially_refunded";
    OrderStatus["FULLY_REFUNDED"] = "fully_refunded";
    OrderStatus["PAYMENT_DISPUTED"] = "payment_disputed";
    OrderStatus["SETTLEMENT_ON_HOLD"] = "settlement_on_hold";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CASH"] = "cash";
    PaymentMethod["CARD"] = "card";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
const orderSchema = new mongoose_1.Schema({
    customer: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Order must belong to a customer'],
    },
    restaurant: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: [true, 'Order must belong to a restaurant'],
    },
    rider: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    items: [
        {
            foodItem: { type: mongoose_1.Schema.Types.ObjectId, ref: 'FoodItem', required: true },
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
}, {
    timestamps: true,
});
const Order = mongoose_1.default.model('Order', orderSchema);
exports.default = Order;
