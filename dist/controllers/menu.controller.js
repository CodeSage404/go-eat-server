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
const zod_1 = require("zod");
const menu_service_1 = __importDefault(require("../services/menu.service"));
const restaurant_service_1 = __importStar(require("../services/restaurant.service"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const foodItem_model_1 = __importDefault(require("../models/foodItem.model"));
const category_model_1 = __importDefault(require("../models/category.model"));
const restaurant_model_1 = __importStar(require("../models/restaurant.model"));
const locationResolver_1 = require("../utils/locationResolver");
const upload_1 = require("../utils/upload");
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
    image: zod_1.z.string().optional(),
    isVegetarian: zod_1.z.union([zod_1.z.boolean(), zod_1.z.enum(['true', 'false', '']).transform(val => val === 'true')]).optional(),
    isVegan: zod_1.z.union([zod_1.z.boolean(), zod_1.z.enum(['true', 'false', '']).transform(val => val === 'true')]).optional(),
    isSpicy: zod_1.z.union([zod_1.z.boolean(), zod_1.z.enum(['true', 'false', '']).transform(val => val === 'true')]).optional(),
    spiceLevel: zod_1.z.coerce.number().min(0).max(3).optional(),
    isGlutenFree: zod_1.z.union([zod_1.z.boolean(), zod_1.z.enum(['true', 'false', '']).transform(val => val === 'true')]).optional(),
    isHalal: zod_1.z.union([zod_1.z.boolean(), zod_1.z.enum(['true', 'false', '']).transform(val => val === 'true')]).optional(),
    isAvailable: zod_1.z.union([zod_1.z.boolean(), zod_1.z.enum(['true', 'false', '']).transform(val => val === 'true')]).optional(),
    isCombo: zod_1.z.union([zod_1.z.boolean(), zod_1.z.enum(['true', 'false', '']).transform(val => val === 'true')]).optional(),
    comboRequired: zod_1.z.union([zod_1.z.boolean(), zod_1.z.enum(['true', 'false', '']).transform(val => val === 'true')]).optional(),
    comboOptions: zod_1.z.union([
        zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            price: zod_1.z.coerce.number(),
            description: zod_1.z.string().optional(),
            image: zod_1.z.string().optional(),
        })),
        zod_1.z.string().transform(val => {
            try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed))
                    return parsed;
            }
            catch { }
            return [];
        })
    ]).optional(),
    optionGroups: zod_1.z.union([
        zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string().min(1, 'Option group name is required'),
            required: zod_1.z.boolean().default(false),
            selectionType: zod_1.z.enum(['single', 'multiple']).default('single'),
            minSelections: zod_1.z.coerce.number().optional().default(0),
            maxSelections: zod_1.z.coerce.number().optional(),
            options: zod_1.z.array(zod_1.z.object({
                name: zod_1.z.string().min(1, 'Option name is required'),
                price: zod_1.z.coerce.number().default(0),
                description: zod_1.z.string().optional(),
                image: zod_1.z.string().optional(),
                isDefault: zod_1.z.boolean().optional().default(false),
            })).default([]),
        })),
        zod_1.z.string().transform(val => {
            try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed))
                    return parsed;
            }
            catch { }
            return [];
        })
    ]).optional(),
    calories: zod_1.z.coerce.number().optional(),
    preparationTime: zod_1.z.coerce.number().optional(),
    prepTime: zod_1.z.coerce.number().optional(),
    originalPrice: zod_1.z.coerce.number().optional().nullable(),
    discountPercentage: zod_1.z.coerce.number().min(0).max(100).optional(),
    allergens: zod_1.z.union([
        zod_1.z.array(zod_1.z.string()),
        zod_1.z.string().transform(val => {
            try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed))
                    return parsed;
            }
            catch { }
            return val.split(',').map(s => s.trim()).filter(Boolean);
        })
    ]).optional(),
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
        this.getAllFoodItems = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { category, restaurant, search, isAvailable } = req.query;
            const query = { isAvailable: isAvailable !== 'false' };
            if (restaurant) {
                query.restaurant = restaurant;
            }
            else {
                const { country, countryCode } = (0, locationResolver_1.resolveRequestLocation)(req);
                if (country || countryCode) {
                    const countryFilter = (0, locationResolver_1.buildCountryFilter)(country, countryCode);
                    const restIds = await restaurant_model_1.default.find({
                        status: restaurant_model_1.RestaurantStatus.ACTIVE,
                        ...countryFilter,
                    }).distinct('_id');
                    query.restaurant = { $in: restIds };
                }
            }
            if (category) {
                const catVal = String(category).trim();
                let matchedIds = [];
                if (catVal.match(/^[0-9a-fA-F]{24}$/)) {
                    matchedIds.push(catVal);
                    const catObj = await category_model_1.default.findById(catVal);
                    if (catObj && catObj.name) {
                        const sames = await category_model_1.default.find({
                            name: {
                                $regex: new RegExp(`^${catObj.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
                            },
                        });
                        matchedIds.push(...sames.map((s) => s._id));
                    }
                }
                else {
                    const sames = await category_model_1.default.find({
                        name: {
                            $regex: new RegExp(`^${catVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
                        },
                    });
                    matchedIds.push(...sames.map((s) => s._id));
                }
                if (matchedIds.length > 0) {
                    query.category = { $in: matchedIds };
                }
            }
            if (search) {
                query.name = { $regex: new RegExp(String(search), 'i') };
            }
            const foodItems = await foodItem_model_1.default.find(query)
                .populate('restaurant', 'name description images rating estimatedDeliveryTime deliveryFee address country countryCode')
                .populate('category', 'name image');
            res.status(200).json({
                status: 'success',
                results: foodItems.length,
                data: {
                    foodItems,
                    items: foodItems,
                },
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
            const foodItemData = {
                ...validatedData.data,
                category: validatedData.data.category,
                restaurant: restaurantId,
                image: req.file?.path || validatedData.data.image || req.body?.image || 'default-food.png',
                preparationTime: validatedData.data.preparationTime || validatedData.data.prepTime || 20,
            };
            if (foodItemData.comboOptions && Array.isArray(foodItemData.comboOptions)) {
                foodItemData.comboOptions = await Promise.all(foodItemData.comboOptions
                    .filter((opt) => opt && opt.name && String(opt.name).trim() !== '')
                    .map(async (opt) => ({
                    ...opt,
                    name: String(opt.name).trim(),
                    price: !isNaN(parseFloat(opt.price)) ? parseFloat(opt.price) : 0,
                    image: opt.image ? await (0, upload_1.processBase64Image)(opt.image, req) : undefined,
                })));
                if (foodItemData.comboOptions.length > 0) {
                    foodItemData.isCombo = true;
                }
            }
            const foodItem = await menu_service_1.default.addFoodItem(foodItemData);
            (0, restaurant_service_1.syncRestaurantPromoStatus)(restaurantId).catch(() => { });
            res.status(201).json({
                status: 'success',
                data: { foodItem },
            });
        });
        this.updateFoodItem = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { restaurantId, id } = req.params;
            await this.checkRestaurantOwnership(restaurantId, req.user._id, req.user.role);
            const updateData = { ...req.body };
            if (req.file?.path) {
                updateData.image = req.file.path;
            }
            if (updateData.prepTime && !updateData.preparationTime) {
                updateData.preparationTime = Number(updateData.prepTime);
            }
            if (updateData.calories !== undefined) {
                updateData.calories = Number(updateData.calories) || undefined;
            }
            if (updateData.originalPrice !== undefined) {
                updateData.originalPrice = updateData.originalPrice === '' || updateData.originalPrice === null ? null : Number(updateData.originalPrice);
            }
            if (updateData.discountPercentage !== undefined) {
                updateData.discountPercentage = updateData.discountPercentage === '' ? 0 : Number(updateData.discountPercentage);
            }
            if (updateData.isCombo !== undefined) {
                updateData.isCombo = updateData.isCombo === true || updateData.isCombo === 'true';
            }
            if (updateData.comboRequired !== undefined) {
                updateData.comboRequired = updateData.comboRequired === true || updateData.comboRequired === 'true';
            }
            if (typeof updateData.comboOptions === 'string') {
                try {
                    updateData.comboOptions = JSON.parse(updateData.comboOptions);
                }
                catch {
                    updateData.comboOptions = [];
                }
            }
            if (Array.isArray(updateData.comboOptions)) {
                updateData.comboOptions = await Promise.all(updateData.comboOptions
                    .filter((opt) => opt && opt.name && String(opt.name).trim() !== '')
                    .map(async (opt) => ({
                    ...opt,
                    name: String(opt.name).trim(),
                    price: !isNaN(parseFloat(opt.price)) ? parseFloat(opt.price) : 0,
                    image: opt.image ? await (0, upload_1.processBase64Image)(opt.image, req) : undefined,
                })));
                if (updateData.comboOptions.length > 0) {
                    updateData.isCombo = true;
                }
            }
            if (typeof updateData.optionGroups === 'string') {
                try {
                    updateData.optionGroups = JSON.parse(updateData.optionGroups);
                }
                catch {
                    updateData.optionGroups = [];
                }
            }
            const foodItem = await menu_service_1.default.updateFoodItem(id, updateData);
            if (!foodItem) {
                throw new appError_1.default('Food item not found', 404);
            }
            (0, restaurant_service_1.syncRestaurantPromoStatus)(restaurantId).catch(() => { });
            res.status(200).json({
                status: 'success',
                data: { foodItem },
            });
        });
        this.deleteFoodItem = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { restaurantId, id } = req.params;
            await this.checkRestaurantOwnership(restaurantId, req.user._id, req.user.role);
            await menu_service_1.default.deleteFoodItem(id);
            (0, restaurant_service_1.syncRestaurantPromoStatus)(restaurantId).catch(() => { });
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
        if (restaurant.owner._id.toString() !== userId.toString() && userRole !== 'admin') {
            throw new appError_1.default('You do not have permission to manage this menu', 403);
        }
    }
}
exports.default = new MenuController();
