import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import Category from '../models/category.model';

class CategoryController {
  /**
   * Get all categories (Global / Cravings categories for Home Screen)
   */
  public getAllCategories = catchAsync(async (req: Request, res: Response) => {
    const categories = await Category.find().sort({ order: 1, name: 1 });

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
    const category = await Category.create(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        category,
      },
    });
  });
}

export default new CategoryController();
