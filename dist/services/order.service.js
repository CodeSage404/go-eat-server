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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const order_model_1 = __importStar(require("../models/order.model"));
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
const user_model_1 = __importStar(require("../models/user.model"));
const io_1 = require("../io");
const notification_service_1 = __importDefault(require("./notification.service"));
const settlement_service_1 = __importDefault(require("./settlement.service"));
const maps_service_1 = __importDefault(require("./maps.service"));
const appError_1 = __importDefault(require("../utils/appError"));
const constants_1 = require("../types/constants");
class OrderService {
    /**
     * Place a new order
     */
    async placeOrder(data) {
        const restaurant = await restaurant_model_1.default.findById(data.restaurant);
        if (!restaurant) {
            throw new appError_1.default('Restaurant not found', 404);
        }
        // Calculate estimated delivery time using Google Maps (Production Logic)
        const travelData = await maps_service_1.default.getDistanceAndTime(restaurant.location?.coordinates || [3.3792, 6.5244], data.deliveryAddress?.coordinates || [3.3792, 6.5244]);
        // Buffer for food preparation (e.g., 20 mins)
        const prepTimeInSeconds = 20 * 60;
        const totalTimeInSeconds = (travelData.durationValue || 0) + prepTimeInSeconds;
        data.estimatedDeliveryTime = new Date(Date.now() + totalTimeInSeconds * 1000);
        // Create the order
        const order = await order_model_1.default.create(data);
        // Notify Restaurant (Vendor) via Push and Socket
        await notification_service_1.default.notifyNewOrder(restaurant.owner.toString(), order._id.toString());
        return order;
    }
    /**
     * Update order status and notify relevant parties
     */
    async updateOrderStatus(orderId, status, userId, role, cancelReason) {
        const order = await order_model_1.default.findById(orderId).populate('customer restaurant rider');
        if (!order) {
            throw new appError_1.default('Order not found', 404);
        }
        // Production-grade permission and status flow validation
        if (role === 'vendor') {
            const restaurantId = order.restaurant?._id
                ? order.restaurant._id.toString()
                : order.restaurant.toString();
            const restaurant = await restaurant_model_1.default.findById(restaurantId);
            if (!restaurant || restaurant.owner.toString() !== userId.toString()) {
                throw new appError_1.default("You do not have permission to manage this outlet's orders", 403);
            }
            const allowedVendorStatuses = [order_model_1.OrderStatus.ACCEPTED, order_model_1.OrderStatus.PREPARING, order_model_1.OrderStatus.READY, order_model_1.OrderStatus.READY_FOR_COLLECTION, order_model_1.OrderStatus.CANCELLED, order_model_1.OrderStatus.CANCELLED_BY_OUTLET];
            if (!allowedVendorStatuses.includes(status)) {
                throw new appError_1.default(`Outlets cannot set order status to ${status}`, 400);
            }
        }
        else if (role === 'rider') {
            if (!order.rider || order.rider._id?.toString() !== userId && order.rider.toString() !== userId) {
                throw new appError_1.default('You are not the assigned courier for this order', 403);
            }
            const allowedRiderStatuses = [order_model_1.OrderStatus.OUT_FOR_DELIVERY, order_model_1.OrderStatus.COURIER_COLLECTED, order_model_1.OrderStatus.DELIVERED, order_model_1.OrderStatus.CANCELLED];
            if (!allowedRiderStatuses.includes(status)) {
                throw new appError_1.default(`Couriers cannot set order status to ${status}`, 400);
            }
        }
        else if (role === 'customer') {
            const customerId = order.customer?._id
                ? order.customer._id.toString()
                : order.customer.toString();
            if (customerId !== userId.toString()) {
                throw new appError_1.default('You are not authorized to manage this order', 403);
            }
            const allowedCustomerStatuses = [order_model_1.OrderStatus.CANCELLED, order_model_1.OrderStatus.CANCELLED_BY_CUSTOMER, order_model_1.OrderStatus.REJECTED];
            if (!allowedCustomerStatuses.includes(status)) {
                throw new appError_1.default(`Customers cannot set order status to ${status}`, 400);
            }
        }
        else if (role !== 'admin') {
            throw new appError_1.default('Unauthorized to update order status', 403);
        }
        // Capture pre-mutation status for cancellation matrix processing
        const previousStatus = order.status;
        order.status = status;
        if (cancelReason) {
            order.cancelReason = cancelReason;
        }
        await order.save();
        // Extract IDs safely from potentially populated fields
        const customerId = order.customer?._id
            ? order.customer._id.toString()
            : order.customer.toString();
        const restaurantDoc = order.restaurant?._id
            ? order.restaurant
            : await restaurant_model_1.default.findById(order.restaurant.toString());
        const vendorUserId = restaurantDoc?.owner?._id
            ? restaurantDoc.owner._id.toString()
            : restaurantDoc?.owner
                ? restaurantDoc.owner.toString()
                : null;
        const shortId = order._id.toString().substring(0, 6).toUpperCase();
        // Status-specific messages for the customer
        const customerMessages = {
            [order_model_1.OrderStatus.ACCEPTED]: `Great news! Your order #${shortId} has been accepted by the outlet.`,
            [order_model_1.OrderStatus.PREPARING]: `Your food is being prepared! Order #${shortId} is cooking now.`,
            [order_model_1.OrderStatus.READY]: `Your order #${shortId} is ready and waiting for a courier to pick it up.`,
            [order_model_1.OrderStatus.READY_FOR_COLLECTION]: `Your order #${shortId} is ready and waiting for a courier to pick it up.`,
            [order_model_1.OrderStatus.OUT_FOR_DELIVERY]: `Your order #${shortId} has been picked up and is on its way!`,
            [order_model_1.OrderStatus.DELIVERED]: `Your order #${shortId} has been delivered. Enjoy your meal!`,
            [order_model_1.OrderStatus.CANCELLED]: `Your order #${shortId} has been cancelled.`,
        };
        // Status-specific messages for the vendor/outlet
        const vendorMessages = {
            [order_model_1.OrderStatus.ACCEPTED]: `You accepted order #${shortId}. Start preparing when ready!`,
            [order_model_1.OrderStatus.PREPARING]: `Order #${shortId} is now marked as preparing.`,
            [order_model_1.OrderStatus.READY]: `Order #${shortId} is marked ready. Waiting for courier pickup.`,
            [order_model_1.OrderStatus.READY_FOR_COLLECTION]: `Order #${shortId} is marked ready. Waiting for courier pickup.`,
            [order_model_1.OrderStatus.OUT_FOR_DELIVERY]: `Order #${shortId} has been picked up by the courier and is on its way to the customer.`,
            [order_model_1.OrderStatus.DELIVERED]: `Order #${shortId} has been delivered successfully!`,
            [order_model_1.OrderStatus.CANCELLED]: `Order #${shortId} has been cancelled.`,
        };
        // Notify Customer
        await notification_service_1.default.notifyOrderStatusUpdate(customerId, order._id.toString(), customerMessages[status] || `Your order #${shortId} status: ${status.replace('_', ' ')}`);
        // Notify Vendor/Outlet (if we have their user ID)
        if (vendorUserId) {
            await notification_service_1.default.notifyVendorOrderUpdate(vendorUserId, order._id.toString(), status, vendorMessages[status] || `Order #${shortId} status: ${status.replace('_', ' ')}`);
        }
        // Operational Policy Settlement Triggers
        if (status === order_model_1.OrderStatus.ACCEPTED) {
            await settlement_service_1.default.processOrderAccepted(order);
        }
        else if (status === order_model_1.OrderStatus.DELIVERED || status === order_model_1.OrderStatus.COMPLETED) {
            await settlement_service_1.default.processOrderCompleted(order);
        }
        else if (status === order_model_1.OrderStatus.CANCELLED ||
            status === order_model_1.OrderStatus.CANCELLED_BY_CUSTOMER ||
            status === order_model_1.OrderStatus.CANCELLED_BY_OUTLET ||
            status === order_model_1.OrderStatus.REJECTED) {
            const initiator = role === 'vendor' ? 'outlet' : role === 'rider' ? 'courier' : role === 'customer' ? 'customer' : 'goeat';
            await settlement_service_1.default.processOrderCancellation(order, initiator, cancelReason || 'Order status cancelled', previousStatus);
        }
        // If order is READY, notify nearby riders
        if (status === order_model_1.OrderStatus.READY || status === order_model_1.OrderStatus.READY_FOR_COLLECTION) {
            this.notifyNearbyRiders(order);
        }
        return order;
    }
    /**
     * Find and notify nearby riders about a ready order
     */
    async notifyNearbyRiders(order) {
        const restaurant = await restaurant_model_1.default.findById(order.restaurant);
        if (!restaurant)
            return;
        // Find riders within Xkm who are online
        const riders = await user_model_1.default.find({
            role: user_model_1.UserRole.RIDER,
            isOnline: true,
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: restaurant.location.coordinates,
                    },
                    $maxDistance: constants_1.APP_CONSTANTS.MAX_RIDER_DISTANCE_METERS,
                },
            },
        });
        riders.forEach((rider) => {
            notification_service_1.default.notifyRiderAvailableOrder(rider._id.toString(), order._id.toString());
        });
    }
    /**
     * Assign a rider to an order
     */
    async assignRider(orderId, riderId) {
        const order = await order_model_1.default.findByIdAndUpdate(orderId, { rider: riderId, status: order_model_1.OrderStatus.COURIER_ASSIGNED }, { new: true }).populate('customer restaurant rider');
        if (order) {
            // Process courier pending earnings
            await settlement_service_1.default.processCourierAssigned(order, riderId);
            // Notify Customer and Restaurant
            (0, io_1.emitToUser)(order.customer._id.toString(), constants_1.SOCKET_EVENTS.RIDER_ASSIGNED, order.rider);
            const restaurant = await restaurant_model_1.default.findById(order.restaurant);
            if (restaurant) {
                (0, io_1.emitToUser)(restaurant.owner.toString(), constants_1.SOCKET_EVENTS.RIDER_ASSIGNED, order.rider);
            }
        }
        return order;
    }
    async getCustomerOrders(customerId) {
        return await order_model_1.default.find({ customer: customerId })
            .populate('restaurant', 'name address image isSelfPickup hasDelivery location')
            .populate('items.foodItem', 'name price image')
            .sort({ createdAt: -1 });
    }
    async getOrderById(orderId) {
        return await order_model_1.default.findById(orderId).populate('customer restaurant rider items.foodItem');
    }
    async getRestaurantOrders(restaurantId) {
        return await order_model_1.default.find({ restaurant: restaurantId }).sort({ createdAt: -1 });
    }
    async getRiderOrders(riderId) {
        return await order_model_1.default.find({ rider: riderId }).sort({ createdAt: -1 });
    }
    async reorder(orderId, customerId) {
        const originalOrder = await order_model_1.default.findById(orderId);
        if (!originalOrder)
            throw new appError_1.default('Original order not found', 404);
        // Create a new order object with same items and restaurant
        const newOrderData = {
            customer: customerId,
            restaurant: originalOrder.restaurant,
            items: originalOrder.items,
            totalAmount: originalOrder.totalAmount,
            deliveryFee: originalOrder.deliveryFee,
            deliveryAddress: originalOrder.deliveryAddress,
            paymentMethod: originalOrder.paymentMethod,
            status: order_model_1.OrderStatus.PENDING
        };
        return await this.placeOrder(newOrderData);
    }
}
exports.default = new OrderService();
