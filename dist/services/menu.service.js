"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const category_model_1 = __importDefault(require("../models/category.model"));
const foodItem_model_1 = __importDefault(require("../models/foodItem.model"));
class MenuService {
    // Category Methods
    async createCategory(data) {
        return await category_model_1.default.create(data);
    }
    async getCategoriesByRestaurant(restaurantId) {
        return await category_model_1.default.find({ restaurant: restaurantId }).sort({ order: 1 });
    }
    async updateCategory(id, data) {
        return await category_model_1.default.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    }
    async deleteCategory(id) {
        // Note: In a real app, you might want to handle what happens to food items in this category
        return await category_model_1.default.findByIdAndDelete(id);
    }
    // Food Item Methods
    async addFoodItem(data) {
        return await foodItem_model_1.default.create(data);
    }
    async getFoodItemsByCategory(categoryId) {
        return await foodItem_model_1.default.find({ category: categoryId, isAvailable: true });
    }
    async getFullMenu(restaurantId) {
        // Get custom categories owned by the restaurant
        const customCategories = await this.getCategoriesByRestaurant(restaurantId);
        // Get all food items for this restaurant, populated with their category
        const allFoodItems = await foodItem_model_1.default.find({ restaurant: restaurantId }).populate('category');
        const categoryMap = new Map();
        // Initialize map with custom categories (so even empty ones show up)
        for (const cat of customCategories) {
            categoryMap.set(cat._id.toString(), {
                ...cat.toObject(),
                items: []
            });
        }
        // Assign food items to their categories
        for (const item of allFoodItems) {
            const cat = item.category;
            if (!cat)
                continue;
            const catId = cat._id.toString();
            if (categoryMap.has(catId)) {
                categoryMap.get(catId).items.push(item.toObject());
            }
            else {
                // Global category (not owned by the restaurant)
                categoryMap.set(catId, {
                    ...(cat.toObject ? cat.toObject() : cat),
                    items: [item.toObject()]
                });
            }
        }
        // Sort categories: Custom categories first (by order), then global categories
        return Array.from(categoryMap.values()).sort((a, b) => {
            const orderA = a.order ?? 999;
            const orderB = b.order ?? 999;
            return orderA - orderB;
        });
    }
    async updateFoodItem(id, data) {
        return await foodItem_model_1.default.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    }
    async deleteFoodItem(id) {
        return await foodItem_model_1.default.findByIdAndDelete(id);
    }
}
exports.default = new MenuService();
