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
const category_model_1 = __importDefault(require("../models/category.model"));
const foodItem_model_1 = __importDefault(require("../models/foodItem.model"));
const restaurant_model_1 = __importStar(require("../models/restaurant.model"));
class CategoryController {
    constructor() {
        /**
         * Get all categories (Global / Cravings categories for Home Screen)
         * Automatically deduplicates any duplicate categories existing in the DB.
         */
        this.getAllCategories = (0, catchAsync_1.catchAsync)(async (req, res) => {
            let categories = await category_model_1.default.find().sort({ order: 1, name: 1 });
            // Check and remove any duplicate categories (case-insensitive per scope)
            const seen = new Map();
            const toDeleteIds = [];
            const replaceMap = new Map(); // dupId -> primaryId
            for (const cat of categories) {
                const nameKey = (cat.name || '').trim().toLowerCase();
                const scopeKey = cat.restaurant ? cat.restaurant.toString() : 'global';
                const key = `${nameKey}___${scopeKey}`;
                if (seen.has(key)) {
                    const primary = seen.get(key);
                    toDeleteIds.push(cat._id);
                    replaceMap.set(cat._id.toString(), primary._id.toString());
                }
                else {
                    seen.set(key, cat);
                }
            }
            if (toDeleteIds.length > 0) {
                // Reassign any food items pointing to duplicates to their primary category
                try {
                    const FoodItemModel = mongoose_1.default.model('FoodItem');
                    for (const [dupId, primaryId] of replaceMap.entries()) {
                        await FoodItemModel.updateMany({ category: dupId }, { $set: { category: primaryId } });
                    }
                }
                catch (err) {
                    // Model might not be registered in standalone test environments; safe ignore
                }
                await category_model_1.default.deleteMany({ _id: { $in: toDeleteIds } });
                // Refresh categories after deduplication
                categories = await category_model_1.default.find().sort({ order: 1, name: 1 });
            }
            res.status(200).json({
                status: 'success',
                results: categories.length,
                data: {
                    categories,
                },
            });
        });
        /**
         * Get category by ID with its food items and restaurants
         */
        this.getCategoryById = (0, catchAsync_1.catchAsync)(async (req, res) => {
            let category = null;
            let categoryName = '';
            const rawId = req.params.id;
            const idStr = Array.isArray(rawId) ? String(rawId[0]) : String(rawId);
            if (mongoose_1.default.Types.ObjectId.isValid(idStr)) {
                category = await category_model_1.default.findById(idStr);
            }
            if (category) {
                categoryName = (category.name || '').trim();
            }
            else {
                categoryName = decodeURIComponent(idStr).trim();
                category = await category_model_1.default.findOne({
                    name: {
                        $regex: new RegExp(`^${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
                    },
                });
            }
            if (!category && !categoryName) {
                throw new appError_1.default('Category not found with that ID or name', 404);
            }
            const matchingCategories = await category_model_1.default.find({
                name: {
                    $regex: new RegExp(`^${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
                },
            });
            const categoryIds = matchingCategories.map((c) => c._id);
            const foodItems = await foodItem_model_1.default.find({
                category: { $in: categoryIds },
                isAvailable: true,
            })
                .populate('restaurant', 'name description images rating estimatedDeliveryTime deliveryFee address')
                .populate('category', 'name image');
            const restaurantIds = new Set();
            const restaurantsList = [];
            for (const item of foodItems) {
                if (item.restaurant &&
                    typeof item.restaurant === 'object' &&
                    'name' in item.restaurant) {
                    const restId = item.restaurant._id?.toString();
                    if (restId && !restaurantIds.has(restId)) {
                        restaurantIds.add(restId);
                        restaurantsList.push(item.restaurant);
                    }
                }
            }
            const cuisineRestaurants = await restaurant_model_1.default.find({
                status: restaurant_model_1.RestaurantStatus.ACTIVE,
                cuisine: { $regex: new RegExp(categoryName, 'i') },
            });
            for (const rest of cuisineRestaurants) {
                const restId = rest._id.toString();
                if (!restaurantIds.has(restId)) {
                    restaurantIds.add(restId);
                    restaurantsList.push(rest);
                }
            }
            res.status(200).json({
                status: 'success',
                data: {
                    category: category || { _id: idStr, name: categoryName },
                    foodItems,
                    items: foodItems,
                    restaurants: restaurantsList,
                },
            });
        });
        /**
         * Create a category
         */
        this.createCategory = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { name, restaurant } = req.body;
            if (name) {
                const trimmedName = String(name).trim();
                const existingQuery = {
                    name: {
                        $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
                    },
                };
                if (restaurant) {
                    existingQuery.restaurant = restaurant;
                }
                else {
                    existingQuery.$or = [
                        { restaurant: { $exists: false } },
                        { restaurant: null },
                    ];
                }
                const existing = await category_model_1.default.findOne(existingQuery);
                if (existing) {
                    throw new appError_1.default(`Category "${trimmedName}" already exists. Please use a different name or edit the existing category.`, 409);
                }
            }
            // Check if an image was uploaded via multer (now Cloudinary URL is in req.file.path)
            if (req.file) {
                req.body.image = req.file.path;
            }
            const category = await category_model_1.default.create(req.body);
            res.status(201).json({
                status: 'success',
                data: {
                    category,
                },
            });
        });
        /**
         * Update a category
         */
        this.updateCategory = (0, catchAsync_1.catchAsync)(async (req, res) => {
            if (req.body.name) {
                const trimmedName = String(req.body.name).trim();
                const targetCategory = await category_model_1.default.findById(req.params.id);
                if (!targetCategory) {
                    throw new appError_1.default('Category not found with that ID', 404);
                }
                const restId = req.body.restaurant || targetCategory.restaurant;
                const existingQuery = {
                    _id: { $ne: req.params.id },
                    name: {
                        $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
                    },
                };
                if (restId) {
                    existingQuery.restaurant = restId;
                }
                else {
                    existingQuery.$or = [
                        { restaurant: { $exists: false } },
                        { restaurant: null },
                    ];
                }
                const existing = await category_model_1.default.findOne(existingQuery);
                if (existing) {
                    throw new appError_1.default(`Category "${trimmedName}" already exists. Please use a different name.`, 409);
                }
            }
            // Check if an image was uploaded via multer (now Cloudinary URL is in req.file.path)
            if (req.file) {
                req.body.image = req.file.path;
            }
            const category = await category_model_1.default.findByIdAndUpdate(req.params.id, req.body, {
                new: true,
                runValidators: true,
            });
            if (!category) {
                throw new appError_1.default('Category not found with that ID', 404);
            }
            res.status(200).json({
                status: 'success',
                data: {
                    category,
                },
            });
        });
        /**
         * Delete a category
         */
        this.deleteCategory = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const category = await category_model_1.default.findByIdAndDelete(req.params.id);
            if (!category) {
                throw new appError_1.default('Category not found with that ID', 404);
            }
            res.status(204).json({
                status: 'success',
                data: null,
            });
        });
    }
}
exports.default = new CategoryController();
