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
const mongoose_1 = __importDefault(require("mongoose"));
const order_model_1 = __importStar(require("../models/order.model"));
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
const foodItem_model_1 = __importDefault(require("../models/foodItem.model"));
const setting_model_1 = __importDefault(require("../models/setting.model"));
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
        const isPickup = data.orderType === 'pickup';
        // 1. Resolve and Validate Coordinates
        const restCoords = restaurant.location?.coordinates;
        if (!restCoords || restCoords.length < 2) {
            throw new appError_1.default('Restaurant location coordinates are not configured.', 400);
        }
        const rawAddress = data.deliveryAddress || {};
        let customerCoords = rawAddress.coordinates;
        const isInvalidCoords = !customerCoords || customerCoords.length < 2 || (customerCoords[0] === 0 && customerCoords[1] === 0);
        if (isInvalidCoords && !isPickup) {
            // Attempt server-side geocoding from text address if coordinates are missing
            const addressString = rawAddress.address || rawAddress.street || '';
            if (addressString.trim()) {
                const geocoded = await maps_service_1.default.geocodeAddress(addressString);
                if (geocoded && geocoded.length >= 2) {
                    customerCoords = [geocoded[0], geocoded[1]];
                }
            }
        }
        data.deliveryAddress = {
            street: rawAddress.street || rawAddress.address || (isPickup ? 'Self-Pickup' : 'Default Delivery Location'),
            building: rawAddress.building || '',
            landmark: rawAddress.landmark || '',
            address: rawAddress.address || rawAddress.street || (isPickup ? 'Self-Pickup' : 'Default Delivery Location'),
            city: rawAddress.city || '',
            state: rawAddress.state || '',
            zipCode: rawAddress.zipCode || '',
            coordinates: customerCoords && customerCoords.length >= 2 ? customerCoords : [0, 0],
        };
        if (!isPickup && (!customerCoords || customerCoords.length < 2 || (customerCoords[0] === 0 && customerCoords[1] === 0))) {
            throw new appError_1.default('Valid delivery location coordinates are required. Please select your address on the map.', 400);
        }
        // 2. Fetch platform settings for fees & thresholds
        const setting = await setting_model_1.default.findOne();
        const maxRadius = restaurant.deliveryRadius || setting?.maxDeliveryDistance || 15;
        const baseFee = setting?.deliveryBaseFee ?? 500;
        const feePerKm = setting?.deliveryFeePerKm ?? 100;
        const serviceFee = setting?.serviceFee ?? 170;
        // 3. Server-side validation of items & price recalculation against FoodItem collection
        if (!data.items || data.items.length === 0) {
            throw new appError_1.default('Order must contain at least one item', 400);
        }
        const itemIds = data.items.map(item => item.foodItem?._id || item.foodItem);
        const dbFoodItems = await foodItem_model_1.default.find({ _id: { $in: itemIds } });
        const foodMap = new Map(dbFoodItems.map(f => [f._id.toString(), f]));
        let computedFoodSubtotal = 0;
        const validatedItems = [];
        for (const item of data.items) {
            const foodIdStr = item.foodItem?._id ? item.foodItem._id.toString() : item.foodItem?.toString();
            const food = foodMap.get(foodIdStr);
            if (!food) {
                throw new appError_1.default(`Food item not found or unavailable: ${item.name || foodIdStr}`, 404);
            }
            const foodRestId = food.restaurant?._id ? food.restaurant._id.toString() : food.restaurant?.toString();
            const targetRestId = restaurant._id.toString();
            if (foodRestId !== targetRestId) {
                throw new appError_1.default(`Item "${food.name}" does not belong to ${restaurant.name}`, 400);
            }
            if (!food.isAvailable) {
                throw new appError_1.default(`Item "${food.name}" is currently sold out or unavailable`, 400);
            }
            const qty = Math.max(1, Number(item.quantity) || 1);
            const verifiedPrice = Number(food.price);
            const addonsTotal = (item.selectedAddons || []).reduce((acc, addon) => acc + (Number(addon.price) || 0), 0);
            const verifiedUnitPrice = verifiedPrice + addonsTotal;
            computedFoodSubtotal += verifiedUnitPrice * qty;
            validatedItems.push({
                foodItem: food._id,
                name: food.name,
                price: verifiedUnitPrice,
                quantity: qty,
                image: food.image || item.image || '',
                selectedAddons: item.selectedAddons || [],
            });
        }
        data.items = validatedItems;
        data.grossAmount = computedFoodSubtotal;
        let finalDistKm = 0;
        const prepTimeInSeconds = 20 * 60;
        let totalTimeInSeconds = prepTimeInSeconds;
        if (!isPickup && customerCoords) {
            // Calculate travel distance and duration
            const travelData = await maps_service_1.default.getDistanceAndTime([restCoords[0], restCoords[1]], [customerCoords[0], customerCoords[1]]);
            const haversineDistKm = this.calculateHaversineDistanceKm(restCoords[1], restCoords[0], customerCoords[1], customerCoords[0]);
            const travelDistKm = travelData.distanceValue ? (travelData.distanceValue / 1000) : haversineDistKm;
            finalDistKm = Number((travelDistKm || haversineDistKm).toFixed(2));
            // Guard: Check if delivery exceeds restaurant delivery radius
            if (finalDistKm > maxRadius) {
                throw new appError_1.default(`Delivery address is outside the maximum delivery radius for ${restaurant.name} (${finalDistKm.toFixed(1)} km > ${maxRadius} km max). Please select an outlet closer to your location.`, 400);
            }
            totalTimeInSeconds = (travelData.durationValue || Math.round(finalDistKm * 3 * 60)) + prepTimeInSeconds;
            // Dynamic distance-based delivery fee calculation (enforced server-side)
            data.deliveryFee = Math.round(baseFee + (finalDistKm * feePerKm));
            data.distanceKm = finalDistKm;
        }
        else {
            data.deliveryFee = 0;
            data.distanceKm = 0;
        }
        data.serviceFee = serviceFee;
        data.totalAmount = computedFoodSubtotal + (data.deliveryFee || 0) + (data.serviceFee || 0) + (Number(data.tipAmount) || 0);
        data.estimatedDeliveryTime = new Date(Date.now() + totalTimeInSeconds * 1000);
        // Auto-generate unique 4-digit Delivery Verification PIN if not provided
        if (!data.deliveryPin) {
            data.deliveryPin = Math.floor(1000 + Math.random() * 9000).toString();
        }
        data.deliveryPinVerified = false;
        // Create the order
        const order = await order_model_1.default.create(data);
        const shortId = order._id.toString().slice(-6).toUpperCase();
        // For CASH orders, send notifications and receipts immediately.
        // For CARD / online payment orders, notifications and receipts are deferred until payment verification in payment.service.ts.
        const isCashOrder = order.paymentMethod?.toLowerCase() === 'cash';
        if (isCashOrder) {
            // Notify Restaurant (Vendor) via Push, Socket, and In-app
            if (restaurant && restaurant.owner) {
                await notification_service_1.default.notifyNewOrder(restaurant.owner.toString(), order._id.toString());
            }
            // Notify Customer via Push, Socket, and In-app
            if (order.customer) {
                const custId = order.customer?._id ? order.customer._id.toString() : order.customer.toString();
                await notification_service_1.default.sendNotification(custId, `Order Placed! 🍽️`, `Your order #${shortId} from ${restaurant.name} has been placed successfully and sent to the outlet!`, { orderId: order._id.toString(), status: 'pending', type: 'ORDER_UPDATE' }, userNotification_model_1.NotificationType.ORDER_UPDATE);
                // Send Itemized Receipt Email to Customer
                try {
                    await order.populate('items.foodItem');
                    const customerUser = await user_model_1.default.findById(custId);
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
                : order.restaurant ? order.restaurant.toString() : '';
            const restaurant = restaurantId ? await restaurant_model_1.default.findById(restaurantId) : null;
            if (!restaurant || (restaurant.owner && restaurant.owner.toString() !== userId.toString())) {
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
            const assignedRiderId = order.rider?._id
                ? order.rider._id.toString()
                : order.rider ? order.rider.toString() : null;
            if (!assignedRiderId || assignedRiderId !== userId.toString()) {
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
                : order.customer ? order.customer.toString() : null;
            if (!customerId || customerId !== userId.toString()) {
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
            : order.customer ? order.customer.toString() : null;
        const restaurantDoc = order.restaurant?._id
            ? order.restaurant
            : order.restaurant ? await restaurant_model_1.default.findById(order.restaurant.toString()) : null;
        const vendorUserId = restaurantDoc?.owner?._id
            ? restaurantDoc.owner._id.toString()
            : restaurantDoc?.owner
                ? restaurantDoc.owner.toString()
                : null;
        const shortId = order._id.toString().substring(0, 6).toUpperCase();
        const outletName = restaurantDoc?.name || 'Outlet';
        const prepTimeText = order.estimatedPrepTime ? `${order.estimatedPrepTime} mins` : '20 mins';
        const effectiveCancelReason = cancelReason || order.cancelReason || '';
        const refundNote = order.refundAmount && order.refundAmount > 0
            ? ` ₦${order.refundAmount.toLocaleString()} has been refunded to your Go-Eat Wallet.`
            : '';
        // Rich status-specific messages for the customer
        const customerMessages = {
            [order_model_1.OrderStatus.ACCEPTED]: `Your order #${shortId} from ${outletName} has been accepted and is being prepared.`,
            [order_model_1.OrderStatus.PREPARING]: `Your meal for order #${shortId} is currently being prepared at ${outletName} (Est. ~${prepTimeText}).`,
            [order_model_1.OrderStatus.READY]: `Your order #${shortId} from ${outletName} is ready and available for pickup!`,
            [order_model_1.OrderStatus.READY_FOR_COLLECTION]: `Your order #${shortId} from ${outletName} is ready and available for pickup!`,
            [order_model_1.OrderStatus.OUT_FOR_DELIVERY]: `Your order #${shortId} has been picked up by the courier and is on the way to your address!`,
            [order_model_1.OrderStatus.DELIVERED]: `Your order #${shortId} from ${outletName} has been delivered. Enjoy your meal!`,
            [order_model_1.OrderStatus.CANCELLED]: effectiveCancelReason
                ? `Your order #${shortId} was cancelled by ${outletName}. Reason: "${effectiveCancelReason}".${refundNote}`
                : `Your order #${shortId} from ${outletName} has been cancelled.${refundNote}`,
        };
        // Rich status-specific titles for customer in-app notifications
        const customerTitles = {
            [order_model_1.OrderStatus.ACCEPTED]: `Order Accepted 🧑‍🍳`,
            [order_model_1.OrderStatus.PREPARING]: `Order Preparing 🍳`,
            [order_model_1.OrderStatus.READY]: `Order Ready for Pickup 📦`,
            [order_model_1.OrderStatus.READY_FOR_COLLECTION]: `Order Ready for Pickup 📦`,
            [order_model_1.OrderStatus.OUT_FOR_DELIVERY]: `Order on the Way 🛵`,
            [order_model_1.OrderStatus.DELIVERED]: `Order Delivered 🎉`,
            [order_model_1.OrderStatus.CANCELLED]: `Order Cancelled ❌`,
        };
        // Rich status-specific messages for the vendor/outlet
        const vendorMessages = {
            [order_model_1.OrderStatus.ACCEPTED]: `You accepted order #${shortId}. Estimated prep time set to ${prepTimeText}.`,
            [order_model_1.OrderStatus.PREPARING]: `Order #${shortId} is marked as preparing.`,
            [order_model_1.OrderStatus.READY]: `Order #${shortId} is marked as ready and available for courier pickup.`,
            [order_model_1.OrderStatus.READY_FOR_COLLECTION]: `Order #${shortId} is marked as ready and available for courier pickup.`,
            [order_model_1.OrderStatus.OUT_FOR_DELIVERY]: `Order #${shortId} has been collected by the courier and is on its way to the customer.`,
            [order_model_1.OrderStatus.DELIVERED]: `Order #${shortId} delivered successfully! Earnings credited to your wallet.`,
            [order_model_1.OrderStatus.CANCELLED]: effectiveCancelReason
                ? `Order #${shortId} cancelled. Reason: "${effectiveCancelReason}".`
                : `Order #${shortId} has been cancelled.`,
        };
        // Notify Customer via Notification Service
        if (customerId) {
            await notification_service_1.default.sendNotification(customerId, customerTitles[status] || `Order Update 🛵`, customerMessages[status] || `Your order #${shortId} status is now ${status.replace('_', ' ')}.`, { orderId: order._id.toString(), status, cancelReason: effectiveCancelReason, refundAmount: order.refundAmount, estimatedPrepTime: order.estimatedPrepTime, type: 'ORDER_UPDATE' }, userNotification_model_1.NotificationType.ORDER_UPDATE);
            // Emit Real-Time Socket Event to Customer
            (0, io_1.emitToUser)(customerId, constants_1.SOCKET_EVENTS.ORDER_STATUS_UPDATE, {
                orderId: order._id.toString(),
                status,
                cancelReason: effectiveCancelReason,
                refundAmount: order.refundAmount,
                estimatedPrepTime: order.estimatedPrepTime,
                estimatedDeliveryTime: order.estimatedDeliveryTime,
            });
            // Also notify customer of real-time wallet refund if applicable
            if (order.refundAmount && order.refundAmount > 0) {
                (0, io_1.emitToUser)(customerId, 'walletBalanceUpdate', {
                    amount: order.refundAmount,
                    reason: 'order_refund',
                    orderId: order._id.toString(),
                });
            }
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
        }
        // Notify Vendor/Outlet
        if (vendorUserId) {
            await notification_service_1.default.notifyVendorOrderUpdate(vendorUserId, order._id.toString(), status, vendorMessages[status] || `Order #${shortId} status: ${status.replace('_', ' ')}`);
            // Schedule late alert if accepted/preparing
            if (status === order_model_1.OrderStatus.ACCEPTED || status === order_model_1.OrderStatus.PREPARING) {
                this.schedulePrepTimeAlert(order._id.toString(), vendorUserId, order.estimatedPrepTime || 20, shortId);
            }
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
     * Find and notify nearby riders about a ready order using geographic proximity matching
     */
    async notifyNearbyRiders(order) {
        try {
            const populatedOrder = await order_model_1.default.findById(order._id)
                .populate('restaurant', 'name address location images phoneContact rating')
                .populate('customer', 'name phoneNumber email profileImage')
                .populate('items.foodItem', 'name price image');
            const restaurantCoords = populatedOrder?.restaurant?.location?.coordinates;
            let candidateRiders = [];
            // Proximity Dispatch (Radius: 10km max distance)
            if (restaurantCoords && restaurantCoords.length >= 2) {
                const [restLng, restLat] = restaurantCoords;
                try {
                    candidateRiders = await user_model_1.default.find({
                        role: user_model_1.UserRole.RIDER,
                        isOnline: true,
                        status: user_model_1.UserStatus.ACTIVE,
                        location: {
                            $near: {
                                $geometry: {
                                    type: 'Point',
                                    coordinates: [Number(restLng), Number(restLat)],
                                },
                                $maxDistance: 10000, // 10,000 meters = 10km
                            },
                        },
                    });
                }
                catch (geoErr) {
                    logger_1.default.warn('Geospatial $near query error, falling back to Haversine calculation:', geoErr);
                }
            }
            // Fallback: If no riders matched via $near, retrieve online active riders and compute distance
            if (!candidateRiders || candidateRiders.length === 0) {
                const allOnlineRiders = await user_model_1.default.find({
                    role: user_model_1.UserRole.RIDER,
                    isOnline: true,
                    status: user_model_1.UserStatus.ACTIVE,
                });
                if (restaurantCoords && restaurantCoords.length >= 2) {
                    const [restLng, restLat] = restaurantCoords;
                    candidateRiders = allOnlineRiders.filter((r) => {
                        const coords = r.location?.coordinates;
                        if (!coords || coords.length < 2)
                            return true; // Include couriers without cached coordinates
                        const distKm = this.calculateHaversineDistanceKm(restLat, restLng, coords[1], coords[0]);
                        return distKm <= 12; // 12km max delivery radius
                    });
                }
                else {
                    candidateRiders = allOnlineRiders;
                }
            }
            if (!candidateRiders || candidateRiders.length === 0) {
                logger_1.default.info(`📡 Proximity Dispatch: No online riders found near order #${order._id}`);
                return;
            }
            // Calculate distance for each candidate rider to the restaurant
            const [restLng, restLat] = restaurantCoords && restaurantCoords.length >= 2
                ? restaurantCoords
                : [3.3792, 6.5244];
            const ridersWithDistance = candidateRiders.map((rider) => {
                const coords = rider.location?.coordinates;
                const distKm = coords && coords.length >= 2
                    ? this.calculateHaversineDistanceKm(restLat, restLng, coords[1], coords[0])
                    : 999;
                return { rider, distKm };
            });
            // Check which riders currently have an active delivery in progress
            const candidateRiderIds = candidateRiders.map((r) => r._id);
            const activeDeliveries = await order_model_1.default.find({
                rider: { $in: candidateRiderIds },
                status: {
                    $in: [
                        order_model_1.OrderStatus.COURIER_ASSIGNED,
                        order_model_1.OrderStatus.COURIER_COLLECTED,
                        order_model_1.OrderStatus.OUT_FOR_DELIVERY,
                    ],
                },
            });
            const busyRiderIds = new Set(activeDeliveries
                .filter((o) => Boolean(o.rider))
                .map((o) => (o.rider?._id ? o.rider._id.toString() : o.rider.toString())));
            // Separate into available (not on an active delivery) vs busy
            const availableRiders = ridersWithDistance
                .filter((item) => !busyRiderIds.has(item.rider._id.toString()))
                .sort((a, b) => a.distKm - b.distKm);
            const busyRiders = ridersWithDistance
                .filter((item) => busyRiderIds.has(item.rider._id.toString()))
                .sort((a, b) => a.distKm - b.distKm);
            // Prioritize the closest available rider. If none available, route to closest busy rider
            const selected = availableRiders.length > 0 ? availableRiders[0] : busyRiders[0];
            if (selected) {
                const targetRider = selected.rider;
                const isBusy = busyRiderIds.has(targetRider._id.toString());
                logger_1.default.info(`📡 Proximity Dispatch: Order #${order._id} assigned to closest ${isBusy ? 'busy' : 'available'} courier ${targetRider._id} (${selected.distKm.toFixed(2)}km)`);
                // Send Push & In-app Notification
                await notification_service_1.default.notifyRiderAvailableOrder(targetRider._id.toString(), order._id.toString());
                // Emit Real-time Socket Event for instantaneous offer modal popup
                (0, io_1.emitToUser)(targetRider._id.toString(), 'NEW_DELIVERY_REQUEST', populatedOrder || order);
            }
        }
        catch (err) {
            logger_1.default.error('Error notifying riders about available order:', err);
        }
    }
    calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) *
                Math.cos(lat2 * (Math.PI / 180)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    /**
     * Schedule late preparation alert notification to the vendor
     */
    schedulePrepTimeAlert(orderId, vendorUserId, prepTimeMinutes, shortId) {
        const delayMs = prepTimeMinutes * 60 * 1000;
        setTimeout(async () => {
            try {
                const checkOrder = await order_model_1.default.findById(orderId);
                if (checkOrder && (checkOrder.status === order_model_1.OrderStatus.ACCEPTED || checkOrder.status === order_model_1.OrderStatus.PREPARING)) {
                    logger_1.default.warn(`⏱️ Prep time expired for order #${shortId}. Sending late alert to vendor ${vendorUserId}.`);
                    await notification_service_1.default.sendNotification(vendorUserId, `Prep Time Alert: Order #${shortId} Running Late! ⏱️`, `Your estimated prep time of ${prepTimeMinutes} mins for order #${shortId} has elapsed. Please finish meal preparation and mark as ready for pickup.`, { orderId, type: 'PREP_TIME_ALERT', status: checkOrder.status }, userNotification_model_1.NotificationType.ORDER_UPDATE);
                }
            }
            catch (err) {
                logger_1.default.error(`Failed to execute prep time alert for order #${shortId}:`, err);
            }
        }, delayMs);
    }
    /**
     * Get available delivery jobs for couriers, with optional proximity sorting
     */
    async getAvailableDeliveryJobs(riderLat, riderLng) {
        const orders = await order_model_1.default.find({
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
        // If rider coordinates provided, filter to nearby jobs (max 25km pickup radius) and sort closest first
        if (riderLat && riderLng && orders.length > 0) {
            const MAX_PICKUP_SEARCH_RADIUS_KM = 25;
            const nearbyOrders = orders.filter((o) => {
                const coords = o.restaurant?.location?.coordinates;
                if (!coords || coords.length < 2)
                    return true;
                const dist = this.calculateHaversineDistanceKm(riderLat, riderLng, coords[1], coords[0]);
                return dist <= MAX_PICKUP_SEARCH_RADIUS_KM;
            });
            return nearbyOrders.sort((a, b) => {
                const coordsA = a.restaurant?.location?.coordinates;
                const coordsB = b.restaurant?.location?.coordinates;
                const distA = coordsA?.length >= 2 ? this.calculateHaversineDistanceKm(riderLat, riderLng, coordsA[1], coordsA[0]) : 9999;
                const distB = coordsB?.length >= 2 ? this.calculateHaversineDistanceKm(riderLat, riderLng, coordsB[1], coordsB[0]) : 9999;
                return distA - distB;
            });
        }
        return orders;
    }
    /**
     * Assign a rider to an order and dispatch push notifications to customer and outlet
     */
    async assignRider(orderId, riderId) {
        // 1. Enforce single active delivery rule: A rider cannot go on more than one delivery at a time
        const existingActiveOrder = await order_model_1.default.findOne({
            rider: riderId,
            status: {
                $in: [
                    order_model_1.OrderStatus.COURIER_ASSIGNED,
                    order_model_1.OrderStatus.COURIER_COLLECTED,
                    order_model_1.OrderStatus.OUT_FOR_DELIVERY,
                ],
            },
        });
        if (existingActiveOrder) {
            throw new appError_1.default('You already have an ongoing delivery in progress. Please complete your current delivery before accepting another.', 400);
        }
        // 2. Atomic assignment: only accept if order is unassigned
        const order = await order_model_1.default.findOneAndUpdate({
            _id: orderId,
            rider: null,
            status: {
                $in: [
                    order_model_1.OrderStatus.ACCEPTED,
                    order_model_1.OrderStatus.PREPARING,
                    order_model_1.OrderStatus.READY,
                    order_model_1.OrderStatus.READY_FOR_COLLECTION,
                ],
            },
        }, { rider: riderId, status: order_model_1.OrderStatus.COURIER_ASSIGNED }, { returnDocument: 'after' }).populate('customer restaurant rider');
        if (!order) {
            throw new appError_1.default('This delivery is no longer available or has already been accepted by another courier.', 400);
        }
        // Double-check race condition: if concurrent assignment happened across multiple requests, rollback
        const riderActiveDeliveries = await order_model_1.default.find({
            rider: riderId,
            status: {
                $in: [
                    order_model_1.OrderStatus.COURIER_ASSIGNED,
                    order_model_1.OrderStatus.COURIER_COLLECTED,
                    order_model_1.OrderStatus.OUT_FOR_DELIVERY,
                ],
            },
        });
        const activeBatchKeys = new Set(riderActiveDeliveries.map(o => o.batchGroupId || o._id.toString()));
        if (activeBatchKeys.size > 1) {
            await order_model_1.default.findByIdAndUpdate(orderId, {
                $unset: { rider: 1 },
                status: order_model_1.OrderStatus.READY_FOR_COLLECTION,
            });
            throw new appError_1.default('You already have an ongoing delivery in progress. Please complete your current delivery before accepting another.', 400);
        }
        // 3. Batched Pickup Assignment: if this order is part of a batched multi-outlet group, link sibling orders to the same courier
        if (order.batchGroupId && order.isBatchedDelivery) {
            await order_model_1.default.updateMany({
                batchGroupId: order.batchGroupId,
                rider: null,
                _id: { $ne: order._id },
            }, { rider: riderId, status: order_model_1.OrderStatus.COURIER_ASSIGNED });
        }
        if (order) {
            // Process courier pending earnings
            await settlement_service_1.default.processCourierAssigned(order, riderId);
            const riderUser = order.rider?._id ? order.rider : await user_model_1.default.findById(riderId);
            const riderName = riderUser?.name || 'A delivery rider';
            const shortId = order._id.toString().substring(0, 6).toUpperCase();
            const restaurantDoc = order.restaurant?._id ? order.restaurant : await restaurant_model_1.default.findById(order.restaurant);
            const restaurantName = restaurantDoc?.name || 'the restaurant';
            // 1. Send Push & In-app Notification to Customer
            const customerId = order.customer?._id
                ? order.customer._id.toString()
                : order.customer?.toString?.();
            if (customerId) {
                await notification_service_1.default.sendNotification(customerId, `Courier Assigned 🛵`, `${riderName} has accepted your order #${shortId} and is on their way to ${restaurantName}!`, {
                    orderId: order._id.toString(),
                    status: order_model_1.OrderStatus.COURIER_ASSIGNED,
                    type: 'RIDER_ASSIGNED',
                    rider: order.rider,
                }, userNotification_model_1.NotificationType.ORDER_UPDATE);
                // Emit Real-time Socket to Customer
                (0, io_1.emitToUser)(customerId, constants_1.SOCKET_EVENTS.RIDER_ASSIGNED, order.rider);
            }
            // 2. Send Push & In-app Notification to Restaurant Outlet
            if (restaurantDoc && restaurantDoc.owner) {
                const vendorOwnerId = restaurantDoc.owner?._id
                    ? restaurantDoc.owner._id.toString()
                    : restaurantDoc.owner?.toString?.();
                if (vendorOwnerId) {
                    await notification_service_1.default.sendNotification(vendorOwnerId, `Courier Assigned 🛵`, `${riderName} has accepted delivery for order #${shortId} and is en route for pickup.`, {
                        orderId: order._id.toString(),
                        status: order_model_1.OrderStatus.COURIER_ASSIGNED,
                        type: 'RIDER_ASSIGNED',
                        rider: order.rider,
                    }, userNotification_model_1.NotificationType.ORDER_UPDATE);
                    // Emit Real-time Socket to Vendor
                    (0, io_1.emitToUser)(vendorOwnerId, constants_1.SOCKET_EVENTS.RIDER_ASSIGNED, order.rider);
                }
            }
            // 3. Send Push & In-app Notification to Rider
            await notification_service_1.default.sendNotification(riderId, `Delivery Accepted! 🚀`, `You've accepted order #${shortId}. Head to ${restaurantName} to collect the order.`, {
                orderId: order._id.toString(),
                status: order_model_1.OrderStatus.COURIER_ASSIGNED,
                type: 'RIDER_ASSIGNED',
                restaurantName,
                orderShortId: shortId,
            }, userNotification_model_1.NotificationType.ORDER_UPDATE);
            // Emit Real-time Socket to Rider
            (0, io_1.emitToUser)(riderId, 'DELIVERY_ACCEPTED_CONFIRMATION', order);
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
        if (!orderId)
            return null;
        const targetId = orderId.includes(',') ? orderId.split(',')[0].trim() : orderId.trim();
        if (!mongoose_1.default.Types.ObjectId.isValid(targetId)) {
            return null;
        }
        return await order_model_1.default.findById(targetId).populate('customer restaurant rider items.foodItem');
    }
    async getRestaurantOrders(restaurantId) {
        return await order_model_1.default.find({ restaurant: restaurantId })
            .populate('customer', 'name phoneNumber email')
            .populate('items.foodItem', 'name price image')
            .sort({ createdAt: -1 });
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
            (order.rider._id?.toString() === userId || (order.rider?.toString?.() === userId));
        let isOutletOwner = false;
        if (role === 'vendor' && order.restaurant) {
            const restaurantId = order.restaurant?._id
                ? order.restaurant._id.toString()
                : order.restaurant?.toString?.();
            const restaurant = restaurantId ? await restaurant_model_1.default.findById(restaurantId) : null;
            if (restaurant && restaurant.owner && restaurant.owner.toString() === userId) {
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
    /**
     * Calculate real-time fee quote for single or multi-outlet carts
     */
    async quoteCheckoutFees(params) {
        const { outlets, deliveryCoordinates, deliveryAddressText, isPickup } = params;
        const setting = await setting_model_1.default.findOne();
        const baseFee = setting?.deliveryBaseFee ?? 500;
        const feePerKm = setting?.deliveryFeePerKm ?? 100;
        const serviceFee = setting?.serviceFee ?? 170;
        const smallOrderFee = setting?.smallOrderFee ?? 150;
        const smallOrderThreshold = setting?.smallOrderFeeThreshold ?? 1000;
        const batchThresholdKm = setting?.batchPickupThresholdKm ?? 3.0;
        const multiOutletExtraStopFee = setting?.multiOutletExtraStopFee ?? 300;
        const maxGlobalRadius = setting?.maxDeliveryDistance ?? 15;
        if (isPickup) {
            return {
                isPickup: true,
                deliveryFee: 0,
                serviceFee: 0,
                smallOrderFee: 0,
                totalFees: 0,
                routingMode: 'PICKUP',
                outlets: outlets.map((o) => ({ ...o, deliveryFee: 0, distanceKm: 0, withinRadius: true })),
            };
        }
        let customerCoords = deliveryCoordinates;
        if ((!customerCoords || customerCoords.length < 2 || (customerCoords[0] === 0 && customerCoords[1] === 0)) && deliveryAddressText) {
            const geocoded = await maps_service_1.default.geocodeAddress(deliveryAddressText);
            if (geocoded && geocoded.length >= 2)
                customerCoords = [geocoded[0], geocoded[1]];
        }
        if (!customerCoords || customerCoords.length < 2 || (customerCoords[0] === 0 && customerCoords[1] === 0)) {
            throw new appError_1.default('Valid delivery coordinates or address are required to calculate delivery fees.', 400);
        }
        // Fetch details for all outlets
        const restaurantDocs = await restaurant_model_1.default.find({ _id: { $in: outlets.map((o) => o.restaurantId) } });
        const restaurantMap = new Map(restaurantDocs.map((r) => [r._id.toString(), r]));
        const outletQuotes = [];
        let totalSubtotal = 0;
        for (const outletItem of outlets) {
            totalSubtotal += (outletItem.subtotal || 0);
            const restDoc = restaurantMap.get(outletItem.restaurantId);
            if (!restDoc) {
                throw new appError_1.default(`Restaurant not found: ${outletItem.restaurantId}`, 404);
            }
            const restCoords = restDoc.location?.coordinates;
            if (!restCoords || restCoords.length < 2) {
                throw new appError_1.default(`Location coordinates not configured for ${restDoc.name}`, 400);
            }
            const haversineDistKm = this.calculateHaversineDistanceKm(restCoords[1], restCoords[0], customerCoords[1], customerCoords[0]);
            const maxRadius = restDoc.deliveryRadius || maxGlobalRadius;
            const withinRadius = haversineDistKm <= maxRadius;
            const singleTripFee = Math.round(baseFee + (haversineDistKm * feePerKm));
            outletQuotes.push({
                restaurantId: outletItem.restaurantId,
                restaurantName: restDoc.name,
                coordinates: restCoords,
                distanceKm: Number(haversineDistKm.toFixed(2)),
                deliveryRadius: maxRadius,
                withinRadius,
                singleTripFee,
                subtotal: outletItem.subtotal,
            });
        }
        // Check if any outlet is outside delivery radius
        const outOfBounds = outletQuotes.find((o) => !o.withinRadius);
        if (outOfBounds) {
            throw new appError_1.default(`${outOfBounds.restaurantName} is outside your delivery radius (${outOfBounds.distanceKm} km > ${outOfBounds.deliveryRadius} km max). Please select items from an outlet closer to you.`, 400);
        }
        // Single outlet vs Multi-outlet routing determination
        let routingMode = 'SINGLE_OUTLET';
        let totalDeliveryFee = 0;
        let outletDistanceKm = 0;
        if (outletQuotes.length === 1) {
            routingMode = 'SINGLE_OUTLET';
            totalDeliveryFee = outletQuotes[0].singleTripFee;
        }
        else {
            // Pairwise distance between Outlet A and Outlet B
            const restA = outletQuotes[0];
            const restB = outletQuotes[1];
            outletDistanceKm = Number(this.calculateHaversineDistanceKm(restA.coordinates[1], restA.coordinates[0], restB.coordinates[1], restB.coordinates[0]).toFixed(2));
            if (outletDistanceKm <= batchThresholdKm) {
                // Approach 1: Single Rider (Batched Pickup)
                routingMode = 'BATCHED_PICKUP';
                const totalBatchedDist = outletDistanceKm + Math.max(restA.distanceKm, restB.distanceKm);
                totalDeliveryFee = Math.round(baseFee + (totalBatchedDist * feePerKm) + multiOutletExtraStopFee);
            }
            else {
                // Approach 2: Split Delivery (Multiple Riders)
                routingMode = 'SPLIT_DELIVERY';
                totalDeliveryFee = outletQuotes.reduce((sum, o) => sum + o.singleTripFee, 0);
            }
        }
        const appliedSmallOrderFee = totalSubtotal < smallOrderThreshold ? smallOrderFee : 0;
        const totalFees = totalDeliveryFee + serviceFee + appliedSmallOrderFee;
        return {
            isPickup: false,
            routingMode,
            outletDistanceKm,
            batchThresholdKm,
            totalDeliveryFee,
            serviceFee,
            smallOrderFee: appliedSmallOrderFee,
            totalFees,
            estimatedTotal: totalSubtotal + totalFees,
            outlets: outletQuotes,
        };
    }
    /**
     * Process a multi-outlet cart checkout with Batched Pickup or Split Delivery routing
     */
    async processMultiOutletCheckout(payload) {
        const { customerId, subOrders, deliveryAddress, paymentMethod, deliveryMode, deliveryTime, deliveryNotes, tipAmount, orderType } = payload;
        if (!subOrders || subOrders.length === 0) {
            throw new appError_1.default('No sub-orders provided for checkout', 400);
        }
        // If single outlet, place normal order
        if (subOrders.length === 1) {
            const singleOrder = await this.placeOrder({
                customer: customerId,
                restaurant: subOrders[0].restaurant,
                items: subOrders[0].items,
                totalAmount: subOrders[0].totalAmount,
                deliveryAddress,
                paymentMethod,
                deliveryMode,
                deliveryTime,
                deliveryNotes,
                tipAmount: tipAmount || 0,
                orderType: orderType || 'delivery',
            });
            return {
                routingMode: 'SINGLE_OUTLET',
                orders: [singleOrder],
                totalCharged: singleOrder.totalAmount,
                totalDeliveryFee: singleOrder.deliveryFee || 0,
            };
        }
        // Multi-outlet checkout: Quote fees and determine routing mode
        const quote = await this.quoteCheckoutFees({
            outlets: subOrders.map((o) => ({
                restaurantId: o.restaurant,
                subtotal: o.totalAmount,
                itemCount: o.items.length,
            })),
            deliveryCoordinates: deliveryAddress?.coordinates,
            deliveryAddressText: deliveryAddress?.address || deliveryAddress?.street,
            isPickup: orderType === 'pickup',
        });
        const batchGroupId = 'BATCH_' + crypto_1.default.randomBytes(6).toString('hex').toUpperCase();
        const isBatched = quote.routingMode === 'BATCHED_PICKUP';
        const createdOrders = [];
        // Distribute delivery fee among sub-orders:
        // If batched, assign full fee to first sub-order and 0 to subsequent
        for (let i = 0; i < subOrders.length; i++) {
            const sub = subOrders[i];
            const assignedDeliveryFee = isBatched
                ? (i === 0 ? (quote.totalDeliveryFee || 0) : 0)
                : (quote.outlets[i]?.singleTripFee || 0);
            const assignedTip = i === 0 ? (tipAmount || 0) : 0;
            const assignedServiceFee = i === 0 ? quote.serviceFee : 0;
            const orderData = {
                customer: customerId,
                restaurant: sub.restaurant,
                items: sub.items,
                totalAmount: sub.totalAmount + assignedDeliveryFee + assignedTip + assignedServiceFee,
                deliveryFee: assignedDeliveryFee,
                serviceFee: assignedServiceFee,
                tipAmount: assignedTip,
                distanceKm: quote.outlets[i]?.distanceKm || 0,
                batchGroupId,
                isBatchedDelivery: isBatched,
                batchSequence: i + 1,
                splitDelivery: !isBatched,
                deliveryAddress,
                paymentMethod,
                deliveryMode,
                deliveryTime,
                deliveryNotes,
                orderType: orderType || 'delivery',
            };
            const created = await this.placeOrder(orderData);
            createdOrders.push(created);
        }
        const totalCharged = createdOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        return {
            batchGroupId,
            routingMode: quote.routingMode,
            orders: createdOrders,
            totalCharged,
            totalDeliveryFee: quote.totalDeliveryFee || 0,
        };
    }
}
exports.default = new OrderService();
