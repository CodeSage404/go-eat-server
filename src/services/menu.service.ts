import Category, { ICategory } from '../models/category.model';
import FoodItem, { IFoodItem } from '../models/foodItem.model';

class MenuService {
  // Category Methods
  async createCategory(data: Partial<ICategory>): Promise<ICategory> {
    return await Category.create(data);
  }

  async getCategoriesByRestaurant(restaurantId: string): Promise<ICategory[]> {
    return await Category.find({ restaurant: restaurantId }).sort({ order: 1 });
  }

  async updateCategory(id: string, data: Partial<ICategory>): Promise<ICategory | null> {
    return await Category.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async deleteCategory(id: string): Promise<ICategory | null> {
    // Note: In a real app, you might want to handle what happens to food items in this category
    return await Category.findByIdAndDelete(id);
  }

  // Food Item Methods
  async addFoodItem(data: Partial<IFoodItem>): Promise<IFoodItem> {
    return await FoodItem.create(data);
  }

  async getFoodItemsByCategory(categoryId: string): Promise<IFoodItem[]> {
    return await FoodItem.find({ category: categoryId, isAvailable: true });
  }

  async getFullMenu(restaurantId: string): Promise<any[]> {
    const categories = await this.getCategoriesByRestaurant(restaurantId);
    const menu = await Promise.all(
      categories.map(async (category) => {
        const items = await FoodItem.find({ category: category._id, restaurant: restaurantId });
        return {
          ...category.toObject(),
          items,
        };
      })
    );
    return menu;
  }

  async updateFoodItem(id: string, data: Partial<IFoodItem>): Promise<IFoodItem | null> {
    return await FoodItem.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async deleteFoodItem(id: string): Promise<IFoodItem | null> {
    return await FoodItem.findByIdAndDelete(id);
  }
}

export default new MenuService();
