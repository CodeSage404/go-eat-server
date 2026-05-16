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
        name: zod_1.z.string(),
        price: zod_1.z.number(),
        quantity: zod_1.z.number().min(1),
    })),
    totalAmount: zod_1.z.number(),
    deliveryFee: zod_1.z.number(),
    deliveryAddress: zod_1.z.object({
        street: zod_1.z.string(),
        city: zod_1.z.string(),
        state: zod_1.z.string(),
        zipCode: zod_1.z.string(),
        coordinates: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number()]),
    }),
    paymentMethod: zod_1.z.nativeEnum(order_model_1.PaymentMethod),
});
class OrderController {
    constructor() {
        this.placeOrder = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const validatedData = orderSchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default(validatedData.error.issues.map(i => i.message).join(', '), 400);
            }
            const order = await order_service_1.default.placeOrder({
                ...req.body,
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
    }
}
exports.default = new OrderController();
