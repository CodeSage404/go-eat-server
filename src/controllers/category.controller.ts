import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import Category from '../models/category.model';
import FoodItem from '../models/foodItem.model';
import Restaurant, { RestaurantStatus } from '../models/restaurant.model';

class CategoryController {
  /**
   * Get all categories (Global / Cravings categories for Home Screen)
   * Automatically deduplicates any duplicate categories existing in the DB.
   */
  public getAllCategories = catchAsync(async (req: Request, res: Response) => {
    let categories = await Category.find().sort({ order: 1, name: 1 });

    // Check and remove any duplicate categories (case-insensitive per scope)
    const seen = new Map<string, any>();
    const toDeleteIds: any[] = [];
    const replaceMap = new Map<string, string>(); // dupId -> primaryId

    for (const cat of categories) {
      const nameKey = (cat.name || '').trim().toLowerCase();
      const scopeKey = cat.restaurant ? cat.restaurant.toString() : 'global';
      const key = `${nameKey}___${scopeKey}`;

      if (seen.has(key)) {
        const primary = seen.get(key);
        toDeleteIds.push(cat._id);
        replaceMap.set(cat._id.toString(), primary._id.toString());
      } else {
        seen.set(key, cat);
      }
    }

    if (toDeleteIds.length > 0) {
      // Reassign any food items pointing to duplicates to their primary category
      try {
        const FoodItemModel = mongoose.model('FoodItem');
        for (const [dupId, primaryId] of replaceMap.entries()) {
          await FoodItemModel.updateMany(
            { category: dupId },
            { $set: { category: primaryId } }
          );
        }
      } catch (err) {
        // Model might not be registered in standalone test environments; safe ignore
      }

      await Category.deleteMany({ _id: { $in: toDeleteIds } });

      // Refresh categories after deduplication
      categories = await Category.find().sort({ order: 1, name: 1 });
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
  public getCategoryById = catchAsync(async (req: Request, res: Response) => {
    let category = null;
    let categoryName = '';
    const rawId = req.params.id;
    const idStr = Array.isArray(rawId) ? String(rawId[0]) : String(rawId);

    if (mongoose.Types.ObjectId.isValid(idStr)) {
      category = await Category.findById(idStr);
    }

    if (category) {
      categoryName = (category.name || '').trim();
    } else {
      categoryName = decodeURIComponent(idStr).trim();
      category = await Category.findOne({
        name: {
          $regex: new RegExp(
            `^${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            'i'
          ),
        },
      });
    }

    if (!category && !categoryName) {
      throw new AppError('Category not found with that ID or name', 404);
    }

    const matchingCategories = await Category.find({
      name: {
        $regex: new RegExp(
          `^${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          'i'
        ),
      },
    });
    const categoryIds = matchingCategories.map((c) => c._id);

    const foodItems = await FoodItem.find({
      category: { $in: categoryIds },
      isAvailable: true,
    })
      .populate(
        'restaurant',
        'name description images rating estimatedDeliveryTime deliveryFee address'
      )
      .populate('category', 'name image');

    const restaurantIds = new Set<string>();
    const restaurantsList: any[] = [];
    for (const item of foodItems) {
      if (
        item.restaurant &&
        typeof item.restaurant === 'object' &&
        'name' in item.restaurant
      ) {
        const restId = (item.restaurant as any)._id?.toString();
        if (restId && !restaurantIds.has(restId)) {
          restaurantIds.add(restId);
          restaurantsList.push(item.restaurant);
        }
      }
    }

    const cuisineRestaurants = await Restaurant.find({
      status: RestaurantStatus.ACTIVE,
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
  public createCategory = catchAsync(async (req: Request, res: Response) => {
    const { name, restaurant } = req.body;
    if (name) {
      const trimmedName = String(name).trim();
      const existingQuery: any = {
        name: {
          $regex: new RegExp(
            `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            'i'
          ),
        },
      };
      if (restaurant) {
        existingQuery.restaurant = restaurant;
      } else {
        existingQuery.$or = [
          { restaurant: { $exists: false } },
          { restaurant: null },
        ];
      }

      const existing = await Category.findOne(existingQuery);
      if (existing) {
        throw new AppError(
          `Category "${trimmedName}" already exists. Please use a different name or edit the existing category.`,
          409
        );
      }
    }

    // Check if an image was uploaded via multer (now Cloudinary URL is in req.file.path)
    if (req.file) {
      req.body.image = req.file.path;
    }

    const category = await Category.create(req.body);

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
  public updateCategory = catchAsync(async (req: Request, res: Response) => {
    if (req.body.name) {
      const trimmedName = String(req.body.name).trim();
      const targetCategory = await Category.findById(req.params.id);
      if (!targetCategory) {
        throw new AppError('Category not found with that ID', 404);
      }

      const restId = req.body.restaurant || targetCategory.restaurant;
      const existingQuery: any = {
        _id: { $ne: req.params.id },
        name: {
          $regex: new RegExp(
            `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            'i'
          ),
        },
      };
      if (restId) {
        existingQuery.restaurant = restId;
      } else {
        existingQuery.$or = [
          { restaurant: { $exists: false } },
          { restaurant: null },
        ];
      }

      const existing = await Category.findOne(existingQuery);
      if (existing) {
        throw new AppError(
          `Category "${trimmedName}" already exists. Please use a different name.`,
          409
        );
      }
    }

    // Check if an image was uploaded via multer (now Cloudinary URL is in req.file.path)
    if (req.file) {
      req.body.image = req.file.path;
    }

    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      throw new AppError('Category not found with that ID', 404);
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
  public deleteCategory = catchAsync(async (req: Request, res: Response) => {
    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      throw new AppError('Category not found with that ID', 404);
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  });
}

export default new CategoryController();
