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
const crypto_1 = __importDefault(require("crypto"));
const order_model_1 = __importStar(require("../models/order.model"));
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
const user_model_1 = __importStar(require("../models/user.model"));
const io_1 = require("../io");
const notification_service_1 = __importDefault(require("./notification.service"));
const settlement_service_1 = __importDefault(require("./settlement.service"));
const email_service_1 = __importDefault(require("./email.service"));
const logger_1 = __importDefault(require("../utils/logger"));
const userNotification_model_1 = require("../models/userNotification.model");
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
        // Auto-generate unique 4-digit Delivery Verification PIN if not provided
        if (!data.deliveryPin) {
            data.deliveryPin = Math.floor(1000 + Math.random() * 9000).toString();
        }
        data.deliveryPinVerified = false;
        // Create the order
        const order = await order_model_1.default.create(data);
        const shortId = order._id.toString().slice(-6).toUpperCase();
        // Notify Restaurant (Vendor) via Push, Socket, and In-app
        await notification_service_1.default.notifyNewOrder(restaurant.owner.toString(), order._id.toString());
        // Notify Customer via Push, Socket, and In-app
        if (order.customer) {
            await notification_service_1.default.sendNotification(order.customer.toString(), `Order Placed! 🍽️`, `Your order #${shortId} from ${restaurant.name} has been placed successfully and sent to the outlet!`, { orderId: order._id.toString(), status: 'pending', type: 'ORDER_UPDATE' }, userNotification_model_1.NotificationType.ORDER_UPDATE);
            // Send Itemized Receipt Email to Customer
            try {
                await order.populate('items.foodItem');
                const customerUser = await user_model_1.default.findById(order.customer);
                if (customerUser && customerUser.email && !customerUser.email.includes('customer@goeat.com')) {
                    email_service_1.default.sendTemplateEmail(customerUser.email, 'ORDER_CONFIRMED', `Order Receipt: #${shortId} from ${restaurant.name}`, {
                        orderId: order._id,
                        customerName: customerUser.name || 'Customer',
                        total: order.totalAmount,
                        items: order.items,
                    }).catch((err) => logger_1.default.warn('Failed to send order placed receipt email:', err.message));
                }
            }
            catch (emailErr) {
                logger_1.default.warn('Error preparing customer receipt email on placeOrder:', emailErr.message);
            }
        }
        return order;
    }
    /**
     * Update order status and notify relevant parties
     */
    async updateOrderStatus(orderId, status, userId, role, cancelReason, estimatedPrepTime) {
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
            const allowedVendorStatuses = [
                order_model_1.OrderStatus.ACCEPTED,
                order_model_1.OrderStatus.PREPARING,
                order_model_1.OrderStatus.READY,
                order_model_1.OrderStatus.READY_FOR_COLLECTION,
                order_model_1.OrderStatus.OUT_FOR_DELIVERY,
                order_model_1.OrderStatus.DELIVERED,
                order_model_1.OrderStatus.CANCELLED,
                order_model_1.OrderStatus.CANCELLED_BY_OUTLET
            ];
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
        if (estimatedPrepTime) {
            order.estimatedPrepTime = estimatedPrepTime;
            order.estimatedDeliveryTime = new Date(Date.now() + estimatedPrepTime * 60 * 1000);
        }
        else if (status === order_model_1.OrderStatus.ACCEPTED || status === order_model_1.OrderStatus.PREPARING) {
            order.estimatedPrepTime = order.estimatedPrepTime || 20;
            order.estimatedDeliveryTime = new Date(Date.now() + order.estimatedPrepTime * 60 * 1000);
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
        const outletName = restaurantDoc?.name || 'Outlet';
        const prepTimeText = order.estimatedPrepTime ? `${order.estimatedPrepTime} mins` : '20 mins';
        // Rich status-specific messages for the customer
        const customerMessages = {
            [order_model_1.OrderStatus.ACCEPTED]: `Order #${shortId} from ${outletName} has been accepted and is being prepared! (Est. prep time: ${prepTimeText})`,
            [order_model_1.OrderStatus.PREPARING]: `Order #${shortId} from ${outletName} is currently cooking! (Est. prep time: ${prepTimeText})`,
            [order_model_1.OrderStatus.READY]: `Order #${shortId} is ready and waiting for courier pickup at ${outletName}.`,
            [order_model_1.OrderStatus.READY_FOR_COLLECTION]: `Order #${shortId} is ready and waiting for courier pickup at ${outletName}.`,
            [order_model_1.OrderStatus.OUT_FOR_DELIVERY]: `Your order #${shortId} from ${outletName} has been picked up and is on its way to your address!`,
            [order_model_1.OrderStatus.DELIVERED]: `Your order #${shortId} from ${outletName} has been delivered. Enjoy your meal!`,
            [order_model_1.OrderStatus.CANCELLED]: `Your order #${shortId} from ${outletName} has been cancelled.`,
        };
        // Rich status-specific titles for customer in-app notifications
        const customerTitles = {
            [order_model_1.OrderStatus.ACCEPTED]: `Order Accepted & Preparing 🧑‍🍳`,
            [order_model_1.OrderStatus.PREPARING]: `Order Cooking 🍳`,
            [order_model_1.OrderStatus.READY]: `Order Ready for Pickup 📦`,
            [order_model_1.OrderStatus.READY_FOR_COLLECTION]: `Order Ready for Pickup 📦`,
            [order_model_1.OrderStatus.OUT_FOR_DELIVERY]: `Order Out for Delivery 🛵`,
            [order_model_1.OrderStatus.DELIVERED]: `Order Delivered 🎉`,
            [order_model_1.OrderStatus.CANCELLED]: `Order Cancelled ❌`,
        };
        // Rich status-specific messages for the vendor/outlet
        const vendorMessages = {
            [order_model_1.OrderStatus.ACCEPTED]: `You accepted order #${shortId}. Estimated prep time set to ${prepTimeText}.`,
            [order_model_1.OrderStatus.PREPARING]: `Order #${shortId} is marked as preparing.`,
            [order_model_1.OrderStatus.READY]: `Order #${shortId} marked ready. Waiting for courier pickup.`,
            [order_model_1.OrderStatus.READY_FOR_COLLECTION]: `Order #${shortId} marked ready. Waiting for courier pickup.`,
            [order_model_1.OrderStatus.OUT_FOR_DELIVERY]: `Order #${shortId} picked up by courier and on its way to customer.`,
            [order_model_1.OrderStatus.DELIVERED]: `Order #${shortId} delivered successfully!`,
            [order_model_1.OrderStatus.CANCELLED]: `Order #${shortId} has been cancelled.`,
        };
        // Notify Customer via Notification Service
        await notification_service_1.default.sendNotification(customerId, customerTitles[status] || `Order Update 🛵`, customerMessages[status] || `Your order #${shortId} status is now ${status.replace('_', ' ')}.`, { orderId: order._id.toString(), status, estimatedPrepTime: order.estimatedPrepTime, type: 'ORDER_UPDATE' }, userNotification_model_1.NotificationType.ORDER_UPDATE);
        // Emit Real-Time Socket Event to Customer
        (0, io_1.emitToUser)(customerId, constants_1.SOCKET_EVENTS.ORDER_STATUS_UPDATE, {
            orderId: order._id.toString(),
            status,
            estimatedPrepTime: order.estimatedPrepTime,
            estimatedDeliveryTime: order.estimatedDeliveryTime,
        });
        if (status === order_model_1.OrderStatus.ACCEPTED || status === order_model_1.OrderStatus.PREPARING) {
            (0, io_1.emitToUser)(customerId, constants_1.SOCKET_EVENTS.ORDER_PREPARING, {
                orderId: order._id.toString(),
                status: 'preparing',
                estimatedPrepTime: order.estimatedPrepTime,
                estimatedDeliveryTime: order.estimatedDeliveryTime,
            });
            // Send Email to Customer informing them order is accepted & being prepared
            const customerUser = order.customer?.email ? order.customer : await user_model_1.default.findById(customerId);
            if (customerUser && customerUser.email && !customerUser.email.includes('customer@goeat.com')) {
                email_service_1.default.sendTemplateEmail(customerUser.email, 'ORDER_PREPARING', `Order Accepted & Being Prepared! 🧑‍🍳`, {
                    orderId: order._id,
                    customerName: customerUser.name || 'Customer',
                    estimatedPrepTime: order.estimatedPrepTime || 20,
                }).catch((err) => logger_1.default.error('Failed to send order preparing email:', err));
            }
        }
        else if (status === order_model_1.OrderStatus.OUT_FOR_DELIVERY && order.deliveryPin) {
            // Send separate dedicated PIN reminder notification
            notification_service_1.default.notifyOrderDeliveryPin(customerId, order._id.toString(), order.deliveryPin).catch((err) => logger_1.default.warn('Failed to send delivery PIN push notification:', err.message));
        }
        // Notify Vendor/Outlet
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
        try {
            const populatedOrder = await order_model_1.default.findById(order._id)
                .populate('restaurant', 'name address location images phoneContact rating')
                .populate('customer', 'name phoneNumber email profileImage')
                .populate('items.foodItem', 'name price image');
            // Find riders who are online
            const riders = await user_model_1.default.find({
                role: user_model_1.UserRole.RIDER,
                isOnline: true,
            });
            riders.forEach((rider) => {
                notification_service_1.default.notifyRiderAvailableOrder(rider._id.toString(), order._id.toString());
                (0, io_1.emitToUser)(rider._id.toString(), 'NEW_DELIVERY_REQUEST', populatedOrder || order);
            });
        }
        catch (err) {
            logger_1.default.error('Error notifying riders about available order:', err);
        }
    }
    /**
     * Get available delivery jobs for couriers
     */
    async getAvailableDeliveryJobs() {
        return await order_model_1.default.find({
            status: {
                $in: [
                    order_model_1.OrderStatus.ACCEPTED,
                    order_model_1.OrderStatus.PREPARING,
                    order_model_1.OrderStatus.READY,
                    order_model_1.OrderStatus.READY_FOR_COLLECTION,
                ],
            },
            rider: null,
        })
            .populate('restaurant', 'name address location images phoneContact rating')
            .populate('customer', 'name phoneNumber email profileImage')
            .populate('items.foodItem', 'name price image')
            .sort({ createdAt: -1 });
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
            status: order_model_1.OrderStatus.PENDING,
        };
        return await this.placeOrder(newOrderData);
    }
    /**
     * Verify delivery PIN and complete order delivery
     */
    async verifyDeliveryPin(orderId, pin, userId, role) {
        const order = await order_model_1.default.findById(orderId).populate('customer restaurant rider');
        if (!order) {
            throw new appError_1.default('Order not found', 404);
        }
        // Role check: Only assigned rider, outlet owner, or admin can verify delivery
        const isSuperAdmin = role === 'admin' || role === 'superadmin';
        const isAssignedRider = order.rider &&
            (order.rider._id?.toString() === userId || order.rider.toString() === userId);
        let isOutletOwner = false;
        if (role === 'vendor') {
            const restaurantId = order.restaurant?._id
                ? order.restaurant._id.toString()
                : order.restaurant.toString();
            const restaurant = await restaurant_model_1.default.findById(restaurantId);
            if (restaurant && restaurant.owner.toString() === userId) {
                isOutletOwner = true;
            }
        }
        if (!isSuperAdmin && !isAssignedRider && !isOutletOwner) {
            throw new appError_1.default('You do not have authorization to confirm delivery for this order', 403);
        }
        if (order.status === order_model_1.OrderStatus.DELIVERED || order.status === order_model_1.OrderStatus.COMPLETED) {
            throw new appError_1.default('This order has already been marked as delivered', 400);
        }
        if (order.status === order_model_1.OrderStatus.CANCELLED || order.status === order_model_1.OrderStatus.REJECTED) {
            throw new appError_1.default('Cannot verify delivery for a cancelled or rejected order', 400);
        }
        // Defend against PIN brute forcing: Max 5 failed attempts per order
        const MAX_PIN_ATTEMPTS = 5;
        const currentAttempts = order.failedPinAttempts || 0;
        if (currentAttempts >= MAX_PIN_ATTEMPTS) {
            throw new appError_1.default('Too many incorrect PIN attempts. For security reasons, this order verification has been locked. Please contact support.', 429);
        }
        // Constant-time PIN verification
        const formattedInputPin = String(pin || '').trim();
        const actualPin = String(order.deliveryPin || '').trim();
        let isPinMatch = false;
        if (actualPin && formattedInputPin) {
            try {
                const inputBuf = Buffer.from(formattedInputPin);
                const actualBuf = Buffer.from(actualPin);
                isPinMatch = (inputBuf.length === actualBuf.length) && crypto_1.default.timingSafeEqual(inputBuf, actualBuf);
            }
            catch {
                isPinMatch = false;
            }
        }
        if (!isPinMatch) {
            await order_model_1.default.findByIdAndUpdate(orderId, { $inc: { failedPinAttempts: 1 } });
            const remainingAttempts = MAX_PIN_ATTEMPTS - (currentAttempts + 1);
            throw new appError_1.default(`Invalid delivery verification PIN. ${remainingAttempts} attempt(s) remaining before order verification is locked.`, 400);
        }
        order.deliveryPinVerified = true;
        order.deliveryPinVerifiedAt = new Date();
        order.failedPinAttempts = 0;
        await order.save();
        // Transition order status to DELIVERED through existing pipeline (notifies customer & triggers settlements)
        const updatedOrder = await this.updateOrderStatus(orderId, order_model_1.OrderStatus.DELIVERED, userId, role);
        return updatedOrder || order;
    }
}
exports.default = new OrderService();
