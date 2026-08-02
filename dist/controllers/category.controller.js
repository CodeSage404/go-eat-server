"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const category_model_1 = __importDefault(require("../models/category.model"));
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
         * Get category by ID
         */
        this.getCategoryById = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const category = await category_model_1.default.findById(req.params.id);
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
