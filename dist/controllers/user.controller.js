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
    }
}
exports.default = new UserController();
