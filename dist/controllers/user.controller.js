"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const user_model_1 = __importDefault(require("../models/user.model"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
class UserController {
    constructor() {
        /**
         * Add a new saved address
         */
        this.addAddress = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const user = await user_model_1.default.findById(req.user._id);
            if (!user)
                throw new appError_1.default('User not found', 404);
            // If setting as default, unset others
            if (req.body.isDefault) {
                user.savedAddresses.forEach(addr => addr.isDefault = false);
            }
            user.savedAddresses.push(req.body);
            await user.save();
            res.status(200).json({
                status: 'success',
                data: { addresses: user.savedAddresses },
            });
        });
        /**
         * Get all saved addresses
         */
        this.getAddresses = (0, catchAsync_1.catchAsync)(async (req, res) => {
            res.status(200).json({
                status: 'success',
                data: { addresses: req.user.savedAddresses },
            });
        });
        /**
         * Delete a saved address
         */
        this.deleteAddress = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const user = await user_model_1.default.findById(req.user._id);
            if (!user)
                throw new appError_1.default('User not found', 404);
            user.savedAddresses = user.savedAddresses.filter((addr) => addr._id.toString() !== req.params.id);
            await user.save();
            res.status(200).json({
                status: 'success',
                data: { addresses: user.savedAddresses },
            });
        });
        /**
         * Toggle a restaurant in favorites
         */
        this.toggleFavorite = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { restaurantId } = req.body;
            const user = await user_model_1.default.findById(req.user._id);
            if (!user)
                throw new appError_1.default('User not found', 404);
            const index = user.favorites.indexOf(restaurantId);
            if (index === -1) {
                user.favorites.push(restaurantId);
            }
            else {
                user.favorites.splice(index, 1);
            }
            await user.save();
            res.status(200).json({
                status: 'success',
                data: { favorites: user.favorites },
            });
        });
        /**
         * Get all favorite restaurants
         */
        this.getFavorites = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const user = await user_model_1.default.findById(req.user._id).populate('favorites');
            res.status(200).json({
                status: 'success',
                data: { favorites: user?.favorites || [] },
            });
        });
        /**
         * Get authenticated user profile
         */
        this.getProfile = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const user = await user_model_1.default.findById(req.user._id).select('-password');
            if (!user) {
                throw new appError_1.default('User not found', 404);
            }
            res.status(200).json({
                status: 'success',
                data: { user },
            });
        });
        /**
         * Update user profile
         */
        this.updateProfile = (0, catchAsync_1.catchAsync)(async (req, res) => {
            // Filter out unwanted fields that shouldn't be manually updated here
            const { name, email, phoneNumber, profileImage } = req.body;
            const updateData = {};
            if (name)
                updateData.name = name;
            if (email && email.trim() !== '')
                updateData.email = email.toLowerCase();
            if (phoneNumber && phoneNumber.trim() !== '')
                updateData.phoneNumber = phoneNumber;
            if (profileImage)
                updateData.profileImage = profileImage;
            // If an explicitly empty string is sent for a unique field, unset it using $unset so it doesn't trigger E11000
            const unsetData = {};
            if (email !== undefined && email.trim() === '')
                unsetData.email = 1;
            if (phoneNumber !== undefined && phoneNumber.trim() === '')
                unsetData.phoneNumber = 1;
            const updatePayload = { $set: updateData };
            if (Object.keys(unsetData).length > 0) {
                updatePayload.$unset = unsetData;
            }
            const user = await user_model_1.default.findByIdAndUpdate(req.user._id, updatePayload, { new: true, runValidators: true }).select('-password');
            if (!user) {
                throw new appError_1.default('User not found', 404);
            }
            res.status(200).json({
                status: 'success',
                data: { user },
            });
        });
    }
}
exports.default = new UserController();
