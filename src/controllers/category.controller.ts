import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import Category from '../models/category.model';
import FoodItem from '../models/foodItem.model';
import Restaurant, { RestaurantStatus } from '../models/restaurant.model';
import { UserRole } from '../models/user.model';
import { resolveRequestLocation, buildCountryFilter } from '../utils/locationResolver';

class CategoryController {
  /**
   * Get all categories (Global / Cravings categories for Home Screen)
   * Automatically deduplicates any duplicate categories existing in the DB.
   */
  public getAllCategories = catchAsync(async (req: Request, res: Response) => {
    const { country, countryCode } = resolveRequestLocation(req);
    const { restaurant, onlyMine, sellingModel, parentId, isSystemPermanent, includeCounts } = req.query;

    let filter: any = {};

    if (sellingModel) {
      filter.sellingModel = sellingModel;
    }

    if (parentId !== undefined) {
      if (parentId === 'null' || parentId === 'root') {
        filter.parentId = null;
      } else if (mongoose.Types.ObjectId.isValid(parentId as string)) {
        filter.parentId = new mongoose.Types.ObjectId(parentId as string);
      }
    }

    if (isSystemPermanent !== undefined) {
      filter.isSystemPermanent = isSystemPermanent === 'true';
    }

    if (restaurant && mongoose.Types.ObjectId.isValid(restaurant as string)) {
      const restObjId = new mongoose.Types.ObjectId(restaurant as string);
      if (onlyMine === 'true') {
        // Return ONLY categories created by this specific restaurant
        filter.restaurant = restObjId;
        filter.isGlobal = false;
      } else {
        // Return global categories + this restaurant's custom categories
        filter.$or = [
          { isGlobal: true },
          { restaurant: restObjId },
        ];
      }
    } else if (country || countryCode) {
      const countryFilter = buildCountryFilter(country, countryCode);
      const activeRestaurants = await Restaurant.find({
        status: RestaurantStatus.ACTIVE,
        ...countryFilter,
      }).select('_id');
      const activeRestIds = activeRestaurants.map(r => r._id);

      const orConditions: any[] = [
        { isGlobal: true, country: { $exists: false } },
        { isGlobal: true, country: null },
      ];
      if (country) {
        orConditions.push({ country: { $regex: new RegExp(`^${country}$`, 'i') } });
      }
      if (countryCode) {
        orConditions.push({ countryCode: { $regex: new RegExp(`^${countryCode}$`, 'i') } });
      }
      if (activeRestIds.length > 0) {
        orConditions.push({ restaurant: { $in: activeRestIds } });
      }

      filter.$or = orConditions;
    }

    let categories = await Category.find(filter)
      .populate('parentId', 'name systemCode')
      .sort({ order: 1, sortOrder: 1, name: 1 });

    // Check and remove any duplicate categories (case-insensitive per scope)
    const seen = new Map<string, any>();
    const toDeleteIds: any[] = [];
    const replaceMap = new Map<string, string>(); // dupId -> primaryId

    for (const cat of categories) {
      // Don't auto-delete permanent system categories
      if (cat.isSystemPermanent) continue;

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
      categories = await Category.find(filter)
        .populate('parentId', 'name systemCode')
        .sort({ order: 1, sortOrder: 1, name: 1 });
    }

    // Optionally attach outlet counts and item counts for Admin monitoring
    let categoryResults: any[] = categories;
    if (includeCounts === 'true') {
      const catIds = categories.map((c) => c._id);
      
      const itemCountsAgg = await FoodItem.aggregate([
        { $match: { category: { $in: catIds } } },
        { $group: { _id: '$category', count: { $sum: 1 }, activeCount: { $sum: { $cond: ['$isAvailable', 1, 0] } } } },
      ]);
      const itemCountMap = new Map(itemCountsAgg.map((a: any) => [a._id.toString(), a]));

      // For outlets: count by categoryCode or cuisine or direct association
      const restaurantsAgg = await Restaurant.aggregate([
        { $group: { _id: '$outletType', count: { $sum: 1 } } },
      ]);
      const outletTypeMap = new Map(restaurantsAgg.map((r: any) => [(r._id || '').toLowerCase(), r.count]));

      categoryResults = categories.map((cat) => {
        const catObj = cat.toObject();
        const itemData = itemCountMap.get(cat._id.toString());
        const catNameLower = (cat.name || '').toLowerCase();
        const outletCount = outletTypeMap.get(catNameLower) || 0;

        return {
          ...catObj,
          itemCount: itemData?.count || 0,
          activeItemCount: itemData?.activeCount || 0,
          outletCount,
        };
      });
    }

    res.status(200).json({
      status: 'success',
      results: categoryResults.length,
      data: {
        categories: categoryResults,
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

    const { country, countryCode } = resolveRequestLocation(req);
    const countryFilter = buildCountryFilter(country, countryCode);

    // Filter active restaurants in this country/location
    const activeRestFilter: any = { status: RestaurantStatus.ACTIVE, ...countryFilter };
    const activeRestaurantsInCountry = await Restaurant.find(activeRestFilter).select('_id');
    const activeRestIds = activeRestaurantsInCountry.map((r) => r._id);

    const foodItemQuery: any = {
      category: { $in: categoryIds },
      isAvailable: true,
    };

    if (country || countryCode) {
      foodItemQuery.restaurant = { $in: activeRestIds };
    }

    const foodItems = await FoodItem.find(foodItemQuery)
      .populate(
        'restaurant',
        'name description images rating estimatedDeliveryTime deliveryFee address country countryCode'
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
      ...activeRestFilter,
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
    const user = (req as any).user;
    let targetRestaurantId = req.body.restaurant;

    // Enforce outlet scope for Vendors
    if (user && user.role === UserRole.VENDOR) {
      if (!targetRestaurantId) {
        const vendorRest = await Restaurant.findOne({ owner: user._id });
        if (vendorRest) {
          targetRestaurantId = vendorRest._id;
        }
      }
      req.body.restaurant = targetRestaurantId;
      req.body.isGlobal = false;
    }

    const { name, restaurant, systemCode, parentId, sellingModel } = req.body;

    if (systemCode) {
      req.body.systemCode = String(systemCode).trim().toUpperCase();
      const existingCode = await Category.findOne({ systemCode: req.body.systemCode });
      if (existingCode) {
        throw new AppError(
          `Permanent category code "${req.body.systemCode}" already exists.`,
          409
        );
      }
    }

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

      if (parentId) {
        existingQuery.parentId = parentId;
      } else {
        existingQuery.$or = [
          { parentId: { $exists: false } },
          { parentId: null },
        ];
      }

      if (restaurant) {
        existingQuery.restaurant = restaurant;
      } else {
        const restCondition = [
          { restaurant: { $exists: false } },
          { restaurant: null },
        ];
        if (existingQuery.$or) {
          existingQuery.$and = [
            { $or: existingQuery.$or },
            { $or: restCondition },
          ];
          delete existingQuery.$or;
        } else {
          existingQuery.$or = restCondition;
        }
      }

      const existing = await Category.findOne(existingQuery);
      if (existing) {
        throw new AppError(
          `Category "${trimmedName}" already exists. Please use a different name or edit your category.`,
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
    const targetCategory = await Category.findById(req.params.id);
    if (!targetCategory) {
      throw new AppError('Category not found with that ID', 404);
    }

    const user = (req as any).user;
    if (user && user.role === UserRole.VENDOR) {
      const vendorRest = await Restaurant.findOne({ owner: user._id });
      const vendorRestId = vendorRest?._id?.toString();
      const catRestId = targetCategory.restaurant?.toString();

      if (targetCategory.isGlobal || !catRestId || catRestId !== vendorRestId) {
        throw new AppError(
          'You do not have permission to edit this category. Vendors can only edit categories created by their outlet.',
          403
        );
      }

      // Prevent vendor from altering ownership or converting to global
      delete req.body.isGlobal;
      delete req.body.restaurant;
      delete req.body.isSystemPermanent;
    }

    // Permanent System Category Lock: prevent modifying systemCode or sellingModel
    if (targetCategory.isSystemPermanent) {
      if (req.body.systemCode && req.body.systemCode !== targetCategory.systemCode) {
        throw new AppError('System code of permanent categories cannot be altered.', 400);
      }
      if (req.body.sellingModel && req.body.sellingModel !== targetCategory.sellingModel) {
        throw new AppError('Selling model of permanent categories cannot be altered.', 400);
      }
      delete req.body.systemCode;
      delete req.body.sellingModel;
      delete req.body.isSystemPermanent;
    }

    if (req.body.name) {
      const trimmedName = String(req.body.name).trim();
      const restId = req.body.restaurant || targetCategory.restaurant;
      const parentId = req.body.parentId !== undefined ? req.body.parentId : targetCategory.parentId;

      const existingQuery: any = {
        _id: { $ne: req.params.id },
        name: {
          $regex: new RegExp(
            `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            'i'
          ),
        },
      };

      if (parentId) {
        existingQuery.parentId = parentId;
      } else {
        existingQuery.$or = [
          { parentId: { $exists: false } },
          { parentId: null },
        ];
      }

      if (restId) {
        existingQuery.restaurant = restId;
      } else {
        const restCondition = [
          { restaurant: { $exists: false } },
          { restaurant: null },
        ];
        if (existingQuery.$or) {
          existingQuery.$and = [
            { $or: existingQuery.$or },
            { $or: restCondition },
          ];
          delete existingQuery.$or;
        } else {
          existingQuery.$or = restCondition;
        }
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
      returnDocument: 'after',
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
    const targetCategory = await Category.findById(req.params.id);
    if (!targetCategory) {
      throw new AppError('Category not found with that ID', 404);
    }

    if (targetCategory.isSystemPermanent) {
      throw new AppError(
        'Permanent system categories cannot be deleted. You can deactivate them instead.',
        400
      );
    }

    // Block deletion if any items are assigned to this category
    const itemsCount = await FoodItem.countDocuments({ category: req.params.id });
    if (itemsCount > 0) {
      throw new AppError(
        `Category cannot be deleted because it is assigned to ${itemsCount} menu or retail item(s). Please deactivate or reassign them first.`,
        400
      );
    }

    // Block deletion if any subcategories are linked
    const subCatsCount = await Category.countDocuments({ parentId: req.params.id });
    if (subCatsCount > 0) {
      throw new AppError(
        `Category cannot be deleted because it has ${subCatsCount} child subcategories. Please reassign or delete subcategories first.`,
        400
      );
    }

    const user = (req as any).user;
    if (user && user.role === UserRole.VENDOR) {
      const vendorRest = await Restaurant.findOne({ owner: user._id });
      const vendorRestId = vendorRest?._id?.toString();
      const catRestId = targetCategory.restaurant?.toString();

      if (targetCategory.isGlobal || !catRestId || catRestId !== vendorRestId) {
        throw new AppError(
          'You do not have permission to delete this category. Vendors can only delete categories created by their outlet.',
          403
        );
      }
    }

    await Category.findByIdAndDelete(req.params.id);

    res.status(204).json({
      status: 'success',
      data: null,
    });
  });

  /**
   * Reorder categories in bulk (Admin only)
   * Receives ordered list of category IDs: { orderedIds: string[] }
   */
  public reorderCategories = catchAsync(async (req: Request, res: Response) => {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new AppError('Please provide an array of ordered category IDs.', 400);
    }

    const bulkOps = orderedIds.map((id: string, index: number) => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(id) },
        update: { $set: { order: index, sortOrder: index } },
      },
    }));

    await Category.bulkWrite(bulkOps);

    res.status(200).json({
      status: 'success',
      message: 'Categories reordered successfully.',
    });
  });
}

export default new CategoryController();
