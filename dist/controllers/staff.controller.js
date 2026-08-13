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
const user_model_1 = __importStar(require("../models/user.model"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
const zod_1 = require("zod");
const inviteStaffSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    customRole: zod_1.z.string().min(2), // e.g., 'Head Chef', 'Cashier'
});
const updateStaffSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    customRole: zod_1.z.string().min(2).optional(),
    status: zod_1.z.enum([user_model_1.UserStatus.ACTIVE, user_model_1.UserStatus.PENDING, user_model_1.UserStatus.SUSPENDED]).optional(),
});
class StaffController {
    constructor() {
        /**
         * Invite/Create a new staff member for the vendor's restaurant
         */
        this.inviteStaff = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const vendor = req.user;
            // Find vendor's restaurant
            const restaurant = await restaurant_model_1.default.findOne({ owner: vendor._id });
            if (!restaurant) {
                throw new appError_1.default('You must have a restaurant to add staff.', 400);
            }
            const validatedData = inviteStaffSchema.parse(req.body);
            // Check if user already exists
            const existingUser = await user_model_1.default.findOne({ email: validatedData.email });
            if (existingUser) {
                throw new appError_1.default('A user with this email already exists.', 400);
            }
            const newStaff = await user_model_1.default.create({
                name: validatedData.name,
                email: validatedData.email,
                password: validatedData.password,
                role: user_model_1.UserRole.STAFF,
                customRole: validatedData.customRole,
                restaurantId: restaurant._id,
                status: user_model_1.UserStatus.ACTIVE,
                isVerified: true, // We auto-verify them since they are created by the vendor
            });
            res.status(201).json({
                status: 'success',
                message: 'Staff member invited successfully',
                data: {
                    staff: {
                        id: newStaff._id,
                        name: newStaff.name,
                        email: newStaff.email,
                        role: newStaff.role,
                        customRole: newStaff.customRole,
                        status: newStaff.status,
                    },
                },
            });
        });
        /**
         * Get all staff members for the vendor's restaurant
         */
        this.getStaff = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const vendor = req.user;
            const restaurant = await restaurant_model_1.default.findOne({ owner: vendor._id });
            if (!restaurant) {
                throw new appError_1.default('You must have a restaurant to view staff.', 400);
            }
            const staff = await user_model_1.default.find({
                restaurantId: restaurant._id,
                role: user_model_1.UserRole.STAFF,
            }).select('name email role customRole status profileImage createdAt');
            res.status(200).json({
                status: 'success',
                results: staff.length,
                data: {
                    staff,
                },
            });
        });
        /**
         * Update a staff member's details
         */
        this.updateStaff = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const vendor = req.user;
            const { id } = req.params;
            const restaurant = await restaurant_model_1.default.findOne({ owner: vendor._id });
            if (!restaurant)
                throw new appError_1.default('You must have a restaurant to update staff.', 400);
            const validatedData = updateStaffSchema.parse(req.body);
            const staffMember = await user_model_1.default.findOneAndUpdate({ _id: id, restaurantId: restaurant._id, role: user_model_1.UserRole.STAFF }, validatedData, { new: true, runValidators: true }).select('name email role customRole status profileImage');
            if (!staffMember) {
                throw new appError_1.default('Staff member not found or does not belong to your restaurant', 404);
            }
            res.status(200).json({
                status: 'success',
                data: {
                    staff: staffMember,
                },
            });
        });
        /**
         * Remove/Delete a staff member
         */
        this.removeStaff = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const vendor = req.user;
            const { id } = req.params;
            const restaurant = await restaurant_model_1.default.findOne({ owner: vendor._id });
            if (!restaurant)
                throw new appError_1.default('You must have a restaurant to remove staff.', 400);
            const staffMember = await user_model_1.default.findOneAndDelete({
                _id: id,
                restaurantId: restaurant._id,
                role: user_model_1.UserRole.STAFF,
            });
            if (!staffMember) {
                throw new appError_1.default('Staff member not found or does not belong to your restaurant', 404);
            }
            res.status(204).json({
                status: 'success',
                data: null,
            });
        });
    }
}
exports.default = new StaffController();
