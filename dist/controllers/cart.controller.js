"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCart = exports.updateCart = exports.getCart = void 0;
const cart_model_1 = __importDefault(require("../models/cart.model"));
const getCart = async (req, res) => {
    try {
        const cart = await cart_model_1.default.findOne({ user: req.user?._id })
            .populate('items.menuItemId')
            .populate('items.restaurant')
            .populate('restaurant');
        if (!cart) {
            return res.status(200).json({ success: true, data: null });
        }
        res.status(200).json({ success: true, data: cart });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCart = getCart;
const updateCart = async (req, res) => {
    try {
        const { restaurantId, items } = req.body;
        if (!items || items.length === 0) {
            await cart_model_1.default.findOneAndDelete({ user: req.user?._id });
            return res.status(200).json({ success: true, data: null });
        }
        const formattedItems = (items || []).map((item) => ({
            menuItemId: item.cartItemId ? (item._id || item.cartItemId.split('_')[0]) : (item._id || item.menuItemId),
            restaurant: item.restaurantId || restaurantId,
            quantity: item.quantity || 1,
        }));
        const cart = await cart_model_1.default.findOneAndUpdate({ user: req.user?._id }, {
            user: req.user?._id,
            restaurant: restaurantId || formattedItems[0]?.restaurant,
            items: formattedItems
        }, { new: true, upsert: true })
            .populate('items.menuItemId')
            .populate('items.restaurant')
            .populate('restaurant');
        res.status(200).json({ success: true, data: cart });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateCart = updateCart;
const clearCart = async (req, res) => {
    try {
        await cart_model_1.default.findOneAndDelete({ user: req.user?._id });
        res.status(200).json({ success: true, data: null });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.clearCart = clearCart;
