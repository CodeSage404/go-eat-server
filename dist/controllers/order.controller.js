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
const orderSchema = zod_1.z.object({
    restaurant: zod_1.z.string(),
    items: zod_1.z.array(zod_1.z.object({
        foodItem: zod_1.z.string(),
        name: zod_1.z.string().optional().default('Food Item'),
        price: zod_1.z.number().optional().default(0),
        quantity: zod_1.z.number().min(1).optional().default(1),
        selectedAddons: zod_1.z.any().optional(),
    })),
    totalAmount: zod_1.z.number().optional().default(0),
    deliveryFee: zod_1.z.number().optional().default(0),
    deliveryAddress: zod_1.z.object({
        street: zod_1.z.string().optional().default('Default Street'),
        city: zod_1.z.string().optional().default('Lagos'),
        state: zod_1.z.string().optional().default('Lagos'),
        zipCode: zod_1.z.string().optional().default('100001'),
        coordinates: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number()]).optional().default([3.3792, 6.5244]),
        address: zod_1.z.string().optional(),
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
                street: rawAddress.street || rawAddress.address || 'Default Street',
                city: rawAddress.city || 'Lagos',
                state: rawAddress.state || 'Lagos',
                zipCode: rawAddress.zipCode || '100001',
                coordinates: rawAddress.coordinates || [3.3792, 6.5244],
                address: rawAddress.address || rawAddress.street || 'Default Street',
            };
            const normalizedItems = (body.items || []).map((item) => ({
                foodItem: item.foodItem || item._id,
                name: item.name || 'Food Item',
                price: Number(item.price) || 0,
                quantity: Number(item.quantity) || 1,
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
            res.status(201).json({
                status: 'success',
                data: { order },
            });
        });
        this.updateStatus = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;
            if (!Object.values(order_model_1.OrderStatus).includes(status)) {
                throw new appError_1.default('Invalid order status', 400);
            }
            const order = await order_service_1.default.updateOrderStatus(id, status, req.user._id, req.user.role);
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
        this.getMyOrders = (0, catchAsync_1.catchAsync)(async (req, res) => {
            let orders = [];
            if (req.user.role === 'customer') {
                orders = await order_service_1.default.getCustomerOrders(req.user._id);
            }
            else if (req.user.role === 'vendor') {
                // Need restaurant ID for vendor
                // For now, get all orders for restaurants owned by this vendor
                throw new appError_1.default('Use specialized vendor endpoints for orders', 400);
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
        /**
         * Quick reorder from history
         */
        this.reorder = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { orderId } = req.params;
            const newOrder = await order_service_1.default.reorder(orderId, req.user._id);
            res.status(201).json({
                status: 'success',
                data: { order: newOrder },
            });
        });
    }
}
exports.default = new OrderController();
