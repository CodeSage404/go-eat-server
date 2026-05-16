import { Request, Response } from 'express';
import User from '../models/user.model';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';

class UserController {
  /**
   * Add a new saved address
   */
  public addAddress = catchAsync(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!._id);
    if (!user) throw new AppError('User not found', 404);

    // If setting as default, unset others
    if (req.body.isDefault) {
      user.savedAddresses.forEach(addr => addr.isDefault = false);
    }

    user.savedAddresses.push(req.body);
    await user.save();

    res.status(200).json({
      status: 'success',
      data: { addresses: user.savedAddresses },
    });
  });

  /**
   * Get all saved addresses
   */
  public getAddresses = catchAsync(async (req: Request, res: Response) => {
    res.status(200).json({
      status: 'success',
      data: { addresses: req.user!.savedAddresses },
    });
  });

  /**
   * Delete a saved address
   */
  public deleteAddress = catchAsync(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!._id);
    if (!user) throw new AppError('User not found', 404);

    user.savedAddresses = user.savedAddresses.filter(
      (addr: any) => addr._id.toString() !== req.params.id
    );
    
    await user.save();

    res.status(200).json({
      status: 'success',
      data: { addresses: user.savedAddresses },
    });
  });

  /**
   * Toggle a restaurant in favorites
   */
  public toggleFavorite = catchAsync(async (req: Request, res: Response) => {
    const { restaurantId } = req.body;
    const user = await User.findById(req.user!._id);
    if (!user) throw new AppError('User not found', 404);

    const index = user.favorites.indexOf(restaurantId);
    if (index === -1) {
      user.favorites.push(restaurantId);
    } else {
      user.favorites.splice(index, 1);
    }

    await user.save();

    res.status(200).json({
      status: 'success',
      data: { favorites: user.favorites },
    });
  });

  /**
   * Get all favorite restaurants
   */
  public getFavorites = catchAsync(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!._id).populate('favorites');
    res.status(200).json({
      status: 'success',
      data: { favorites: user?.favorites || [] },
    });
  });
}

export default new UserController();
