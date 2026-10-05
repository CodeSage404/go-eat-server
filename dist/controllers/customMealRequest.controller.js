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
const mongoose_1 = __importDefault(require("mongoose"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const customMealRequest_model_1 = __importDefault(require("../models/customMealRequest.model"));
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
const order_model_1 = __importStar(require("../models/order.model"));
const user_model_1 = require("../models/user.model");
class CustomMealRequestController {
    constructor() {
        /**
         * Customer creates a new custom request for a Signature Chef
         */
        this.createRequest = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { restaurantId, requestText, photos, specialNotes } = req.body;
            if (!restaurantId || !mongoose_1.default.Types.ObjectId.isValid(restaurantId)) {
                throw new appError_1.default('Valid restaurant ID is required', 400);
            }
            if (!requestText || String(requestText).trim().length === 0) {
                throw new appError_1.default('Request details are required', 400);
            }
            const restaurant = await restaurant_model_1.default.findById(restaurantId);
            if (!restaurant) {
                throw new appError_1.default('Chef / Restaurant not found', 404);
            }
            let photoUrls = [];
            if (Array.isArray(photos)) {
                photoUrls = photos;
            }
            else if (req.files && Array.isArray(req.files)) {
                photoUrls = req.files.map((f) => f.path);
            }
            const request = await customMealRequest_model_1.default.create({
                customer: req.user._id,
                restaurant: restaurantId,
                requestText: String(requestText).trim(),
                photos: photoUrls,
                specialNotes: specialNotes ? String(specialNotes).trim() : '',
                status: 'pending',
            });
            await request.populate('restaurant', 'name images outletType address');
            res.status(201).json({
                status: 'success',
                data: { request },
            });
        });
        /**
         * Get custom requests list (filtered by role: Vendor, Customer, or Admin)
         */
        this.getRequests = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { status, restaurantId } = req.query;
            const filter = {};
            if (status) {
                filter.status = status;
            }
            if (req.user.role === user_model_1.UserRole.VENDOR) {
                const vendorRest = await restaurant_model_1.default.findOne({ owner: req.user._id });
                if (!vendorRest) {
                    return res.status(200).json({ status: 'success', data: { requests: [] } });
                }
                filter.restaurant = vendorRest._id;
            }
            else if (req.user.role === user_model_1.UserRole.CUSTOMER) {
                filter.customer = req.user._id;
            }
            else if (req.user.role === user_model_1.UserRole.ADMIN) {
                if (restaurantId && mongoose_1.default.Types.ObjectId.isValid(restaurantId)) {
                    filter.restaurant = restaurantId;
                }
            }
            const requests = await customMealRequest_model_1.default.find(filter)
                .populate('customer', 'name email phone avatar')
                .populate('restaurant', 'name images outletType address')
                .sort({ createdAt: -1 });
            res.status(200).json({
                status: 'success',
                results: requests.length,
                data: { requests },
            });
        });
        /**
         * Get single custom request by ID
         */
        this.getRequestById = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const request = await customMealRequest_model_1.default.findById(req.params.id)
                .populate('customer', 'name email phone avatar')
                .populate('restaurant', 'name images outletType address');
            if (!request) {
                throw new appError_1.default('Custom request not found', 404);
            }
            res.status(200).json({
                status: 'success',
                data: { request },
            });
        });
        /**
         * Chef sends itemized quote to customer
         */
        this.sendQuote = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const { itemName, price, deliveryFee, chefMessage } = req.body;
            const request = await customMealRequest_model_1.default.findById(id);
            if (!request) {
                throw new appError_1.default('Custom request not found', 404);
            }
            // Verify vendor ownership
            if (req.user.role === user_model_1.UserRole.VENDOR) {
                const vendorRest = await restaurant_model_1.default.findOne({ owner: req.user._id });
                if (!vendorRest || vendorRest._id.toString() !== request.restaurant.toString()) {
                    throw new appError_1.default('You do not have permission to quote this request', 403);
                }
            }
            const mealPrice = Number(price);
            const mealDeliveryFee = Number(deliveryFee) || 0;
            if (isNaN(mealPrice) || mealPrice <= 0) {
                throw new appError_1.default('Please provide a valid price for the custom meal', 400);
            }
            request.quote = {
                itemName: itemName ? String(itemName).trim() : 'Custom Chef Special',
                price: mealPrice,
                deliveryFee: mealDeliveryFee,
                total: mealPrice + mealDeliveryFee,
                chefMessage: chefMessage ? String(chefMessage).trim() : '',
                quotedAt: new Date(),
            };
            request.status = 'priced';
            await request.save();
            await request.populate('customer', 'name email phone avatar');
            res.status(200).json({
                status: 'success',
                data: { request },
            });
        });
        /**
         * Customer accepts quote and converts into an Order
         */
        this.acceptQuote = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const { deliveryAddress, paymentMethod, deliveryNotes } = req.body;
            const request = await customMealRequest_model_1.default.findById(id);
            if (!request) {
                throw new appError_1.default('Custom request not found', 404);
            }
            if (request.customer.toString() !== req.user._id.toString()) {
                throw new appError_1.default('You do not have permission to accept this quote', 403);
            }
            if (request.status !== 'priced' || !request.quote) {
                throw new appError_1.default('This request has not received an active quote yet', 400);
            }
            const restaurant = await restaurant_model_1.default.findById(request.restaurant);
            if (!restaurant) {
                throw new appError_1.default('Restaurant not found', 404);
            }
            const quote = request.quote;
            const grossAmount = quote.price;
            const deliveryFee = quote.deliveryFee;
            const totalAmount = quote.total;
            // Create order directly from custom quote
            const order = await order_model_1.default.create({
                customer: req.user._id,
                restaurant: restaurant._id,
                items: [
                    {
                        name: quote.itemName,
                        price: quote.price,
                        quantity: 1,
                        notes: request.requestText + (request.specialNotes ? ` | Note: ${request.specialNotes}` : ''),
                    },
                ],
                grossAmount,
                deliveryFee,
                totalAmount,
                deliveryAddress: deliveryAddress || {
                    street: 'Delivery Address',
                    city: restaurant.address.city,
                    state: restaurant.address.state,
                    zipCode: '100001',
                },
                paymentMethod: paymentMethod || order_model_1.PaymentMethod.CARD,
                deliveryNotes: deliveryNotes || request.specialNotes || '',
                status: order_model_1.OrderStatus.ACCEPTED,
            });
            request.status = 'accepted';
            request.order = order._id;
            await request.save();
            res.status(200).json({
                status: 'success',
                data: {
                    request,
                    order,
                },
            });
        });
        /**
         * Update request status (e.g. Reject / Cancel / Complete)
         */
        this.updateStatus = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;
            if (!['pending', 'priced', 'accepted', 'rejected', 'completed', 'cancelled'].includes(status)) {
                throw new appError_1.default('Invalid status value', 400);
            }
            const request = await customMealRequest_model_1.default.findById(id);
            if (!request) {
                throw new appError_1.default('Custom request not found', 404);
            }
            request.status = status;
            await request.save();
            res.status(200).json({
                status: 'success',
                data: { request },
            });
        });
    }
}
exports.default = new CustomMealRequestController();
