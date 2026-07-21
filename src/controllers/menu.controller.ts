import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import menuService from '../services/menu.service';
import restaurantService from '../services/restaurant.service';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
  order: z.number().optional(),
});

const foodItemSchema = z.object({
  name: z.string().min(1, 'Food item name is required'),
  description: z.string().min(5, 'Description is too short'),
  price: z.coerce.number().positive('Price must be positive'),
  category: z.string().min(1, 'Category ID is required'),
  isVegetarian: z.enum(['true', 'false', '']).transform(val => val === 'true').optional(),
  isSpicy: z.enum(['true', 'false', '']).transform(val => val === 'true').optional(),
  calories: z.coerce.number().optional(),
});

class MenuController {
  private async checkRestaurantOwnership(restaurantId: string, userId: string, userRole: string) {
    const restaurant = await restaurantService.getRestaurantById(restaurantId);
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    if (restaurant.owner._id.toString() !== userId && userRole !== 'admin') {
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

  // Food Item Controllers
  public addFoodItem = catchAsync(async (req: any, res: Response) => {
    const { restaurantId } = req.params;
    await this.checkRestaurantOwnership(restaurantId as string, req.user._id, req.user.role);

    const validatedData = foodItemSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError(validatedData.error.issues.map(i => i.message).join(', '), 400);
    }

    const foodItem = await menuService.addFoodItem({
      ...validatedData.data,
      category: validatedData.data.category as any,
      restaurant: restaurantId as any,
      image: req.file?.path
    });

    res.status(201).json({
      status: 'success',
      data: { foodItem },
    });
  });

  public updateFoodItem = catchAsync(async (req: any, res: Response) => {
    const { id } = req.params;
    // In a real app, we would verify the food item belongs to a restaurant the user owns
    const foodItem = await menuService.updateFoodItem(id, req.body);

    if (!foodItem) {
      throw new AppError('Food item not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { foodItem },
    });
  });

  public deleteFoodItem = catchAsync(async (req: any, res: Response) => {
    const { id } = req.params;
    await menuService.deleteFoodItem(id as string);

    res.status(204).json({
      status: 'success',
      data: null,
    });
  });
}

export default new MenuController();
