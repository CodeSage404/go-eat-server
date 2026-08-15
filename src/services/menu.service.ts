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
    // Get custom categories owned by the restaurant
    const customCategories = await this.getCategoriesByRestaurant(restaurantId);
    
    // Get all food items for this restaurant, populated with their category
    const allFoodItems = await FoodItem.find({ restaurant: restaurantId }).populate('category');

    const categoryMap = new Map<string, any>();

    // Initialize map with custom categories (so even empty ones show up)
    for (const cat of customCategories) {
      categoryMap.set(cat._id.toString(), {
        ...cat.toObject(),
        items: []
      });
    }

    // Assign food items to their categories
    for (const item of allFoodItems) {
      const cat: any = item.category;
      if (!cat) continue;
      
      const catId = cat._id.toString();
      if (categoryMap.has(catId)) {
        categoryMap.get(catId).items.push(item.toObject());
      } else {
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

  async updateFoodItem(id: string, data: Partial<IFoodItem>): Promise<IFoodItem | null> {
    return await FoodItem.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async deleteFoodItem(id: string): Promise<IFoodItem | null> {
    return await FoodItem.findByIdAndDelete(id);
  }
}

export default new MenuService();
