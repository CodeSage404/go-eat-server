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
        const categories = await this.getCategoriesByRestaurant(restaurantId);
        const menu = await Promise.all(categories.map(async (category) => {
            const items = await foodItem_model_1.default.find({ category: category._id, restaurant: restaurantId });
            return {
                ...category.toObject(),
                items,
            };
        }));
        return menu;
    }
    async updateFoodItem(id, data) {
        return await foodItem_model_1.default.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    }
    async deleteFoodItem(id) {
        return await foodItem_model_1.default.findByIdAndDelete(id);
    }
}
exports.default = new MenuService();
