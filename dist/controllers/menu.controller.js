"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const menu_service_1 = __importDefault(require("../services/menu.service"));
const restaurant_service_1 = __importDefault(require("../services/restaurant.service"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const categorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Category name is required'),
    description: zod_1.z.string().optional(),
    order: zod_1.z.number().optional(),
});
const foodItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Food item name is required'),
    description: zod_1.z.string().optional(),
    price: zod_1.z.coerce.number().positive('Price must be positive'),
    category: zod_1.z.string().min(1, 'Category ID is required'),
    isVegetarian: zod_1.z.enum(['true', 'false', '']).transform(val => val === 'true').optional(),
    isSpicy: zod_1.z.enum(['true', 'false', '']).transform(val => val === 'true').optional(),
    calories: zod_1.z.coerce.number().optional(),
});
class MenuController {
    constructor() {
        // Category Controllers
        this.createCategory = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { restaurantId } = req.params;
            await this.checkRestaurantOwnership(restaurantId, req.user._id, req.user.role);
            const validatedData = categorySchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default(validatedData.error.issues.map(i => i.message).join(', '), 400);
            }
            const category = await menu_service_1.default.createCategory({
                ...req.body,
                restaurant: restaurantId,
            });
            res.status(201).json({
                status: 'success',
                data: { category },
            });
        });
        this.getMenu = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { restaurantId } = req.params;
            const menu = await menu_service_1.default.getFullMenu(restaurantId);
            res.status(200).json({
                status: 'success',
                data: { menu },
            });
        });
        // Food Item Controllers
        this.addFoodItem = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { restaurantId } = req.params;
            await this.checkRestaurantOwnership(restaurantId, req.user._id, req.user.role);
            const validatedData = foodItemSchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default(validatedData.error.issues.map(i => i.message).join(', '), 400);
            }
            const foodItem = await menu_service_1.default.addFoodItem({
                ...validatedData.data,
                category: validatedData.data.category,
                restaurant: restaurantId,
                image: req.file?.path
            });
            res.status(201).json({
                status: 'success',
                data: { foodItem },
            });
        });
        this.updateFoodItem = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            // In a real app, we would verify the food item belongs to a restaurant the user owns
            const foodItem = await menu_service_1.default.updateFoodItem(id, req.body);
            if (!foodItem) {
                throw new appError_1.default('Food item not found', 404);
            }
            res.status(200).json({
                status: 'success',
                data: { foodItem },
            });
        });
        this.deleteFoodItem = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            await menu_service_1.default.deleteFoodItem(id);
            res.status(204).json({
                status: 'success',
                data: null,
            });
        });
    }
    async checkRestaurantOwnership(restaurantId, userId, userRole) {
        const restaurant = await restaurant_service_1.default.getRestaurantById(restaurantId);
        if (!restaurant) {
            throw new appError_1.default('Restaurant not found', 404);
        }
        if (restaurant.owner._id.toString() !== userId && userRole !== 'admin') {
            throw new appError_1.default('You do not have permission to manage this menu', 403);
        }
    }
}
exports.default = new MenuController();
