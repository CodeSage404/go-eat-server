"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promo_model_1 = __importDefault(require("../models/promo.model"));
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
class PromoController {
    constructor() {
        /**
         * Admin/Vendor: Create a new promotion
         */
        this.createPromo = (0, catchAsync_1.catchAsync)(async (req, res) => {
            if (req.user.role === 'vendor') {
                const restaurant = await restaurant_model_1.default.findOne({ owner: req.user._id });
                if (!restaurant)
                    throw new appError_1.default('No restaurant found for this vendor', 404);
                req.body.restaurant = restaurant._id.toString();
            }
            const promo = await promo_model_1.default.create(req.body);
            res.status(201).json({
                status: 'success',
                data: { promo },
            });
        });
        /**
         * Vendor: Get all promos
         */
        this.getVendorPromos = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const restaurant = await restaurant_model_1.default.findOne({ owner: req.user._id });
            if (!restaurant)
                throw new appError_1.default('No restaurant found for this vendor', 404);
            const promos = await promo_model_1.default.find({ restaurant: restaurant._id });
            res.status(200).json({ status: 'success', results: promos.length, data: { promos } });
        });
        /**
         * Vendor: Update promo
         */
        this.updateVendorPromo = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const restaurant = await restaurant_model_1.default.findOne({ owner: req.user._id });
            if (!restaurant)
                throw new appError_1.default('No restaurant found for this vendor', 404);
            const promo = await promo_model_1.default.findOneAndUpdate({ _id: id, restaurant: restaurant._id }, req.body, { new: true, runValidators: true });
            if (!promo)
                throw new appError_1.default('Promo not found or not owned by vendor', 404);
            res.status(200).json({ status: 'success', data: { promo } });
        });
        /**
         * Vendor: Delete promo
         */
        this.deleteVendorPromo = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const restaurant = await restaurant_model_1.default.findOne({ owner: req.user._id });
            if (!restaurant)
                throw new appError_1.default('No restaurant found for this vendor', 404);
            const promo = await promo_model_1.default.findOneAndDelete({ _id: id, restaurant: restaurant._id });
            if (!promo)
                throw new appError_1.default('Promo not found or not owned by vendor', 404);
            res.status(204).json({ status: 'success', data: null });
        });
        /**
         * Customer: Validate and Apply a Promo Code
         */
        this.applyPromo = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { code, orderAmount, restaurantId } = req.body;
            const promo = await promo_model_1.default.findOne({ code: code.toUpperCase(), isActive: true });
            if (!promo) {
                throw new appError_1.default('Invalid or inactive promo code', 400);
            }
            if (promo.expiryDate < new Date()) {
                throw new appError_1.default('This promo code has expired', 400);
            }
            if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
                throw new appError_1.default('This promo code has reached its usage limit', 400);
            }
            if (orderAmount < promo.minOrderAmount) {
                throw new appError_1.default(`Minimum order amount of ${promo.minOrderAmount} required`, 400);
            }
            if (promo.restaurant && promo.restaurant.toString() !== restaurantId) {
                throw new appError_1.default('This promo code is not valid for this restaurant', 400);
            }
            // Calculate discount
            let discount = (promo.discountPercentage / 100) * orderAmount;
            if (promo.maxDiscountAmount && discount > promo.maxDiscountAmount) {
                discount = promo.maxDiscountAmount;
            }
            res.status(200).json({
                status: 'success',
                data: {
                    discountAmount: discount,
                    newTotal: orderAmount - discount,
                },
            });
        });
    }
}
exports.default = new PromoController();
