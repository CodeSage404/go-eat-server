import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import Category from '../models/category.model';

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
   * Get category by ID
   */
  public getCategoryById = catchAsync(async (req: Request, res: Response) => {
    const category = await Category.findById(req.params.id);

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
