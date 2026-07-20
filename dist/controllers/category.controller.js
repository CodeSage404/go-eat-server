"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const category_model_1 = __importDefault(require("../models/category.model"));
class CategoryController {
    constructor() {
        /**
         * Get all categories (Global / Cravings categories for Home Screen)
         */
        this.getAllCategories = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const categories = await category_model_1.default.find().sort({ order: 1, name: 1 });
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
            const category = await category_model_1.default.create(req.body);
            res.status(201).json({
                status: 'success',
                data: {
                    category,
                },
            });
        });
    }
}
exports.default = new CategoryController();
