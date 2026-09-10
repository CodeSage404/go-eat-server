"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const order_service_1 = __importDefault(require("../services/order.service"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const order_model_1 = require("../models/order.model");
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
const setting_model_1 = __importDefault(require("../models/setting.model"));
const email_service_1 = __importDefault(require("../services/email.service"));
const orderSchema = zod_1.z.object({
    restaurant: zod_1.z.string(),
    items: zod_1.z.array(zod_1.z.object({
        foodItem: zod_1.z.string(),
        name: zod_1.z.string().optional().default('Food Item'),
        price: zod_1.z.number().optional().default(0),
        quantity: zod_1.z.number().min(1).optional().default(1),
        image: zod_1.z.string().optional(),
        selectedAddons: zod_1.z.any().optional(),
    })),
    totalAmount: zod_1.z.number().optional().default(0),
    deliveryFee: zod_1.z.number().optional().default(0),
    deliveryAddress: zod_1.z.object({
        street: zod_1.z.string().optional(),
        city: zod_1.z.string().optional(),
        state: zod_1.z.string().optional(),
        zipCode: zod_1.z.string().optional(),
        coordinates: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number()]).optional(),
        address: zod_1.z.string().optional(),
        building: zod_1.z.string().optional(),
        landmark: zod_1.z.string().optional(),
    }),
    paymentMethod: zod_1.z.nativeEnum(order_model_1.PaymentMethod).optional().default(order_model_1.PaymentMethod.CARD),
    deliveryMode: zod_1.z.string().optional(),
    deliveryTime: zod_1.z.string().optional(),
    deliveryNotes: zod_1.z.string().optional(),
});
class OrderController {
    constructor() {
        this.placeOrder = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const body = req.body || {};
            const rawAddress = body.deliveryAddress || {};
            const normalizedAddress = {
                street: rawAddress.street || rawAddress.address || 'Address',
                city: rawAddress.city || '',
                state: rawAddress.state || '',
                zipCode: rawAddress.zipCode || '',
                coordinates: rawAddress.coordinates,
                address: rawAddress.address || rawAddress.street || '',
                building: rawAddress.building || '',
                landmark: rawAddress.landmark || '',
            };
            const normalizedItems = (body.items || []).map((item) => ({
                foodItem: item.foodItem || item._id,
                name: item.name || 'Food Item',
                price: Number(item.price) || 0,
                quantity: Number(item.quantity) || 1,
                image: item.image || item.foodItem?.image || '',
                selectedAddons: item.selectedAddons || [],
            }));
            const normalizedBody = {
                ...body,
                items: normalizedItems,
                totalAmount: Number(body.totalAmount) || 0,
                deliveryFee: Number(body.deliveryFee) || 0,
                deliveryAddress: normalizedAddress,
                paymentMethod: body.paymentMethod || order_model_1.PaymentMethod.CARD,
            };
            const validatedData = orderSchema.safeParse(normalizedBody);
            if (!validatedData.success) {
                throw new appError_1.default(validatedData.error.issues.map(i => i.message).join(', '), 400);
            }
            if (!req.user.name) {
                req.user.name = 'Customer';
            }
            if (!req.user.email) {
                req.user.email = `${req.user.phoneNumber || 'customer'}@goeat.com`;
            }
            const order = await order_service_1.default.placeOrder({
                ...normalizedBody,
                customer: req.user._id,
            });
            await order.populate('items.foodItem');
            // Send emails immediately only for CASH orders.
            // For CARD orders, emails are sent after successful payment verification.
            if (order.paymentMethod === order_model_1.PaymentMethod.CASH) {
                if (req.user.email && !req.user.email.includes('customer@goeat.com')) {
                    email_service_1.default.sendTemplateEmail(req.user.email, 'ORDER_CONFIRMED', `Order Confirmed: #${order._id.toString().slice(-6).toUpperCase()}`, {
                        orderId: order._id,
                        customerName: req.user.name,
                        total: order.totalAmount,
                        items: order.items
                    }).catch((err) => console.error('Failed to send order email:', err));
                }
                const restaurant = await restaurant_model_1.default.findById(order.restaurant).populate('owner');
                const vendorEmail = restaurant?.businessEmail || restaurant?.owner?.email;
                if (vendorEmail) {
                    email_service_1.default.sendTemplateEmail(vendorEmail, 'VENDOR_ORDER_RECEIVED', `New Order Received: #${order._id.toString().slice(-6).toUpperCase()}`, {
                        orderId: order._id,
                        outletName: restaurant?.name || 'Partner',
                        customerName: req.user.name || 'Customer',
                        total: order.totalAmount,
                        items: order.items,
                    }, 'partners').catch((err) => console.error('Failed to send vendor order email:', err));
                }
            }
            res.status(201).json({
                status: 'success',
                data: { order },
            });
        });
        this.updateStatus = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const { status, cancelReason, estimatedPrepTime } = req.body;
            if (!Object.values(order_model_1.OrderStatus).includes(status)) {
                throw new appError_1.default('Invalid order status', 400);
            }
            const order = await order_service_1.default.updateOrderStatus(id, status, req.user._id, req.user.role, cancelReason, estimatedPrepTime ? Number(estimatedPrepTime) : undefined);
            res.status(200).json({
                status: 'success',
                data: { order },
            });
        });
        this.acceptDelivery = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params; // Order ID
            const riderId = req.user._id;
            const order = await order_service_1.default.assignRider(id, riderId);
            res.status(200).json({
                status: 'success',
                data: { order },
            });
        });
        this.getAvailableJobs = (0, catchAsync_1.catchAsync)(async (_req, res) => {
            const orders = await order_service_1.default.getAvailableDeliveryJobs();
            res.status(200).json({
                status: 'success',
                results: orders.length,
                data: { orders },
            });
        });
        this.getMyOrders = (0, catchAsync_1.catchAsync)(async (req, res) => {
            let orders = [];
            if (req.user.role === 'customer') {
                orders = await order_service_1.default.getCustomerOrders(req.user._id);
            }
            else if (req.user.role === 'vendor') {
                const restaurant = await restaurant_model_1.default.findOne({ owner: req.user._id });
                if (!restaurant) {
                    throw new appError_1.default('No restaurant found for this vendor', 404);
                }
                orders = await order_service_1.default.getRestaurantOrders(restaurant._id.toString());
                orders = orders.map((ord) => {
                    const obj = ord.toObject ? ord.toObject() : { ...ord };
                    delete obj.deliveryPin;
                    return obj;
                });
            }
            else if (req.user.role === 'rider') {
                orders = await order_service_1.default.getRiderOrders(req.user._id);
            }
            res.status(200).json({
                status: 'success',
                results: orders?.length,
                data: { orders },
            });
        });
        this.getOrderById = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const order = await order_service_1.default.getOrderById(id);
            if (!order) {
                throw new appError_1.default('Order not found', 404);
            }
            const orderObj = order.toObject ? order.toObject() : { ...order };
            if (req.user.role === 'vendor') {
                delete orderObj.deliveryPin;
            }
            res.status(200).json({
                status: 'success',
                data: { order: orderObj },
            });
        });
        /**
         * Quick reorder from history
         */
        this.reorder = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { orderId, id } = req.params;
            const targetId = orderId || id;
            const newOrder = await order_service_1.default.reorder(targetId, req.user._id);
            res.status(201).json({
                status: 'success',
                data: { order: newOrder },
            });
        });
        /**
         * Verify delivery PIN from customer and mark order as delivered
         */
        this.verifyDeliveryPin = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const pinSchema = zod_1.z.object({
                pin: zod_1.z.string().min(4, 'Delivery PIN must be at least 4 digits').max(6, 'Delivery PIN is maximum 6 digits'),
            });
            const validated = pinSchema.safeParse(req.body);
            if (!validated.success) {
                throw new appError_1.default(validated.error.issues.map((i) => i.message).join(', '), 400);
            }
            const order = await order_service_1.default.verifyDeliveryPin(id, validated.data.pin, req.user._id.toString(), req.user.role);
            res.status(200).json({
                status: 'success',
                message: 'Delivery verified successfully',
                data: { order },
            });
        });
        /**
         * Calculate dynamic checkout fees (delivery fee, service fee, small order fee)
         */
        this.quoteFees = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { outlets, deliveryCoordinates, deliveryAddressText, isPickup } = req.body;
            if (!outlets || !Array.isArray(outlets) || outlets.length === 0) {
                throw new appError_1.default('Outlets array is required for fee quotation', 400);
            }
            const quote = await order_service_1.default.quoteCheckoutFees({
                outlets,
                deliveryCoordinates,
                deliveryAddressText,
                isPickup: Boolean(isPickup),
            });
            res.status(200).json({
                status: 'success',
                data: quote,
            });
        });
        /**
         * Place multi-outlet checkout order(s) (Batched Pickup vs Split Delivery)
         */
        this.placeMultiOutletOrder = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const body = req.body || {};
            const { subOrders, deliveryAddress, paymentMethod, deliveryMode, deliveryTime, deliveryNotes, tipAmount, orderType } = body;
            if (!subOrders || !Array.isArray(subOrders) || subOrders.length === 0) {
                throw new appError_1.default('subOrders array is required for multi-outlet checkout', 400);
            }
            const result = await order_service_1.default.processMultiOutletCheckout({
                customerId: req.user._id,
                subOrders,
                deliveryAddress,
                paymentMethod: paymentMethod || order_model_1.PaymentMethod.CARD,
                deliveryMode,
                deliveryTime,
                deliveryNotes,
                tipAmount: Number(tipAmount) || 0,
                orderType,
            });
            res.status(201).json({
                status: 'success',
                data: result,
            });
        });
        /**
         * Get public platform fee configuration (delivery base fee, rate per km, service fee)
         */
        this.getPublicFees = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const setting = await setting_model_1.default.findOne();
            res.status(200).json({
                status: 'success',
                data: {
                    deliveryBaseFee: setting?.deliveryBaseFee ?? 500,
                    deliveryFeePerKm: setting?.deliveryFeePerKm ?? 100,
                    serviceFee: setting?.serviceFee ?? 170,
                    smallOrderFee: setting?.smallOrderFee ?? 150,
                    smallOrderFeeThreshold: setting?.smallOrderFeeThreshold ?? 1000,
                    batchPickupThresholdKm: setting?.batchPickupThresholdKm ?? 3.0,
                    multiOutletExtraStopFee: setting?.multiOutletExtraStopFee ?? 300,
                    maxDeliveryDistance: setting?.maxDeliveryDistance ?? 15,
                },
            });
        });
    }
}
exports.default = new OrderController();
