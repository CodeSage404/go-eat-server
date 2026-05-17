"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promo_model_1 = __importDefault(require("../models/promo.model"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
class PromoController {
    constructor() {
        /**
         * Admin/Vendor: Create a new promotion
         */
        this.createPromo = (0, catchAsync_1.catchAsync)(async (req, res) => {
            // If vendor, bind promo to their restaurant
            if (req.user.role === 'vendor') {
                req.body.restaurant = req.user._id; // Realistically should be the restaurant ID they own, but simplifying for now.
            }
            const promo = await promo_model_1.default.create(req.body);
            res.status(201).json({
                status: 'success',
                data: { promo },
            });
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
