import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import menuService from '../services/menu.service';
import restaurantService from '../services/restaurant.service';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import FoodItem from '../models/foodItem.model';
import Category from '../models/category.model';
import Restaurant, { RestaurantStatus } from '../models/restaurant.model';
import { resolveRequestLocation, buildCountryFilter } from '../utils/locationResolver';
import { processBase64Image } from '../utils/upload';

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
  order: z.number().optional(),
});

const foodItemSchema = z.object({
  name: z.string().min(1, 'Food item name is required'),
  description: z.string().optional(),
  price: z.coerce.number().positive('Price must be positive'),
  category: z.string().min(1, 'Category ID is required'),
  isVegetarian: z.union([z.boolean(), z.enum(['true', 'false', '']).transform(val => val === 'true')]).optional(),
  isVegan: z.union([z.boolean(), z.enum(['true', 'false', '']).transform(val => val === 'true')]).optional(),
  isSpicy: z.union([z.boolean(), z.enum(['true', 'false', '']).transform(val => val === 'true')]).optional(),
  spiceLevel: z.coerce.number().min(0).max(3).optional(),
  isGlutenFree: z.union([z.boolean(), z.enum(['true', 'false', '']).transform(val => val === 'true')]).optional(),
  isHalal: z.union([z.boolean(), z.enum(['true', 'false', '']).transform(val => val === 'true')]).optional(),
  isAvailable: z.union([z.boolean(), z.enum(['true', 'false', '']).transform(val => val === 'true')]).optional(),
  isCombo: z.union([z.boolean(), z.enum(['true', 'false', '']).transform(val => val === 'true')]).optional(),
  comboRequired: z.union([z.boolean(), z.enum(['true', 'false', '']).transform(val => val === 'true')]).optional(),
  comboOptions: z.union([
    z.array(z.object({
      name: z.string(),
      price: z.coerce.number(),
      description: z.string().optional(),
      image: z.string().optional(),
    })),
    z.string().transform(val => {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return [];
    })
  ]).optional(),
  optionGroups: z.union([
    z.array(z.object({
      name: z.string().min(1, 'Option group name is required'),
      required: z.boolean().default(false),
      selectionType: z.enum(['single', 'multiple']).default('single'),
      minSelections: z.coerce.number().optional().default(0),
      maxSelections: z.coerce.number().optional(),
      options: z.array(z.object({
        name: z.string().min(1, 'Option name is required'),
        price: z.coerce.number().default(0),
        description: z.string().optional(),
        image: z.string().optional(),
        isDefault: z.boolean().optional().default(false),
      })).default([]),
    })),
    z.string().transform(val => {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return [];
    })
  ]).optional(),
  calories: z.coerce.number().optional(),
  preparationTime: z.coerce.number().optional(),
  prepTime: z.coerce.number().optional(),
  originalPrice: z.coerce.number().optional().nullable(),
  discountPercentage: z.coerce.number().min(0).max(100).optional(),
  allergens: z.union([
    z.array(z.string()),
    z.string().transform(val => {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return val.split(',').map(s => s.trim()).filter(Boolean);
    })
  ]).optional(),
});

class MenuController {
  private async checkRestaurantOwnership(restaurantId: string, userId: any, userRole: string) {
    const restaurant = await restaurantService.getRestaurantById(restaurantId);
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    if (restaurant.owner._id.toString() !== userId.toString() && userRole !== 'admin') {
      throw new AppError('You do not have permission to manage this menu', 403);
    }
  }

  // Category Controllers
  public createCategory = catchAsync(async (req: any, res: Response) => {
    const { restaurantId } = req.params;
    await this.checkRestaurantOwnership(restaurantId as string, req.user._id, req.user.role);

    const validatedData = categorySchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError(validatedData.error.issues.map(i => i.message).join(', '), 400);
    }

    const category = await menuService.createCategory({
      ...req.body,
      restaurant: restaurantId as any,
    });

    res.status(201).json({
      status: 'success',
      data: { category },
    });
  });

  public getMenu = catchAsync(async (req: Request, res: Response) => {
    const { restaurantId } = req.params;
    const menu = await menuService.getFullMenu(restaurantId as string);

    res.status(200).json({
      status: 'success',
      data: { menu },
    });
  });

  public getAllFoodItems = catchAsync(async (req: Request, res: Response) => {
    const { category, restaurant, search, isAvailable } = req.query;
    const query: any = { isAvailable: isAvailable !== 'false' };

    if (restaurant) {
      query.restaurant = restaurant;
    } else {
      const { country, countryCode } = resolveRequestLocation(req);
      if (country || countryCode) {
        const countryFilter = buildCountryFilter(country, countryCode);
        const restIds = await Restaurant.find({
          status: RestaurantStatus.ACTIVE,
          ...countryFilter,
        }).distinct('_id');
        query.restaurant = { $in: restIds };
      }
    }

    if (category) {
      const catVal = String(category).trim();
      let matchedIds: any[] = [];
      if (catVal.match(/^[0-9a-fA-F]{24}$/)) {
        matchedIds.push(catVal);
        const catObj = await Category.findById(catVal);
        if (catObj && catObj.name) {
          const sames = await Category.find({
            name: {
              $regex: new RegExp(
                `^${catObj.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
                'i'
              ),
            },
          });
          matchedIds.push(...sames.map((s) => s._id));
        }
      } else {
        const sames = await Category.find({
          name: {
            $regex: new RegExp(
              `^${catVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
              'i'
            ),
          },
        });
        matchedIds.push(...sames.map((s) => s._id));
      }
      if (matchedIds.length > 0) {
        query.category = { $in: matchedIds };
      }
    }

    if (search) {
      query.name = { $regex: new RegExp(String(search), 'i') };
    }

    const foodItems = await FoodItem.find(query)
      .populate(
        'restaurant',
        'name description images rating estimatedDeliveryTime deliveryFee address country countryCode'
      )
      .populate('category', 'name image');

    res.status(200).json({
      status: 'success',
      results: foodItems.length,
      data: {
        foodItems,
        items: foodItems,
      },
    });
  });

  // Food Item Controllers
  public addFoodItem = catchAsync(async (req: any, res: Response) => {
    const { restaurantId } = req.params;
    await this.checkRestaurantOwnership(restaurantId as string, req.user._id, req.user.role);

    const validatedData = foodItemSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError(validatedData.error.issues.map(i => i.message).join(', '), 400);
    }

    const foodItemData: any = {
      ...validatedData.data,
      category: validatedData.data.category as any,
      restaurant: restaurantId as any,
      image: req.file?.path || 'default-food.png',
      preparationTime: validatedData.data.preparationTime || validatedData.data.prepTime || 20,
    };

    if (foodItemData.comboOptions && Array.isArray(foodItemData.comboOptions)) {
      foodItemData.comboOptions = await Promise.all(
        foodItemData.comboOptions.map(async (opt: any) => ({
          ...opt,
          image: opt.image ? await processBase64Image(opt.image, req) : undefined,
        }))
      );
    }

    const foodItem = await menuService.addFoodItem(foodItemData);

    res.status(201).json({
      status: 'success',
      data: { foodItem },
    });
  });

  public updateFoodItem = catchAsync(async (req: any, res: Response) => {
    const { restaurantId, id } = req.params;
    await this.checkRestaurantOwnership(restaurantId as string, req.user._id, req.user.role);

    const updateData: any = { ...req.body };
    if (updateData.prepTime && !updateData.preparationTime) {
      updateData.preparationTime = Number(updateData.prepTime);
    }
    if (updateData.calories !== undefined) {
      updateData.calories = Number(updateData.calories) || undefined;
    }
    if (updateData.originalPrice !== undefined) {
      updateData.originalPrice = updateData.originalPrice === '' || updateData.originalPrice === null ? null : Number(updateData.originalPrice);
    }
    if (updateData.discountPercentage !== undefined) {
      updateData.discountPercentage = updateData.discountPercentage === '' ? 0 : Number(updateData.discountPercentage);
    }
    if (updateData.isCombo !== undefined) {
      updateData.isCombo = updateData.isCombo === true || updateData.isCombo === 'true';
    }
    if (updateData.comboRequired !== undefined) {
      updateData.comboRequired = updateData.comboRequired === true || updateData.comboRequired === 'true';
    }
    if (typeof updateData.comboOptions === 'string') {
      try {
        updateData.comboOptions = JSON.parse(updateData.comboOptions);
      } catch {
        updateData.comboOptions = [];
      }
    }
    if (Array.isArray(updateData.comboOptions)) {
      updateData.comboOptions = await Promise.all(
        updateData.comboOptions.map(async (opt: any) => ({
          ...opt,
          image: opt.image ? await processBase64Image(opt.image, req) : undefined,
        }))
      );
    }
    if (typeof updateData.optionGroups === 'string') {
      try {
        updateData.optionGroups = JSON.parse(updateData.optionGroups);
      } catch {
        updateData.optionGroups = [];
      }
    }

    const foodItem = await menuService.updateFoodItem(id, updateData);

    if (!foodItem) {
      throw new AppError('Food item not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { foodItem },
    });
  });

  public deleteFoodItem = catchAsync(async (req: any, res: Response) => {
    const { restaurantId, id } = req.params;
    await this.checkRestaurantOwnership(restaurantId as string, req.user._id, req.user.role);

    await menuService.deleteFoodItem(id as string);

    res.status(204).json({
      status: 'success',
      data: null,
    });
  });
}

export default new MenuController();
