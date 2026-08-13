import { Request, Response } from 'express';
import Promo from '../models/promo.model';
import Restaurant from '../models/restaurant.model';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';

class PromoController {
  /**
   * Admin/Vendor: Create a new promotion
   */
  public createPromo = catchAsync(async (req: Request, res: Response) => {
    if (req.user!.role === 'vendor') {
      const restaurant = await Restaurant.findOne({ owner: req.user!._id });
      if (!restaurant) throw new AppError('No restaurant found for this vendor', 404);
      req.body.restaurant = restaurant._id.toString();
    }

    const promo = await Promo.create(req.body);

    res.status(201).json({
      status: 'success',
      data: { promo },
    });
  });

  /**
   * Vendor: Get all promos
   */
  public getVendorPromos = catchAsync(async (req: any, res: Response) => {
    const restaurant = await Restaurant.findOne({ owner: req.user._id });
    if (!restaurant) throw new AppError('No restaurant found for this vendor', 404);
    
    const promos = await Promo.find({ restaurant: restaurant._id });
    res.status(200).json({ status: 'success', results: promos.length, data: { promos } });
  });

  /**
   * Vendor: Update promo
   */
  public updateVendorPromo = catchAsync(async (req: any, res: Response) => {
    const { id } = req.params;
    const restaurant = await Restaurant.findOne({ owner: req.user._id });
    if (!restaurant) throw new AppError('No restaurant found for this vendor', 404);
    
    const promo = await Promo.findOneAndUpdate(
      { _id: id, restaurant: restaurant._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!promo) throw new AppError('Promo not found or not owned by vendor', 404);
    
    res.status(200).json({ status: 'success', data: { promo } });
  });

  /**
   * Vendor: Delete promo
   */
  public deleteVendorPromo = catchAsync(async (req: any, res: Response) => {
    const { id } = req.params;
    const restaurant = await Restaurant.findOne({ owner: req.user._id });
    if (!restaurant) throw new AppError('No restaurant found for this vendor', 404);
    
    const promo = await Promo.findOneAndDelete({ _id: id, restaurant: restaurant._id });
    if (!promo) throw new AppError('Promo not found or not owned by vendor', 404);
    
    res.status(204).json({ status: 'success', data: null });
  });

  /**
   * Customer: Validate and Apply a Promo Code
   */
  public applyPromo = catchAsync(async (req: Request, res: Response) => {
    const { code, orderAmount, restaurantId } = req.body;

    const promo = await Promo.findOne({ code: code.toUpperCase(), isActive: true });

    if (!promo) {
      throw new AppError('Invalid or inactive promo code', 400);
    }

    if (promo.expiryDate < new Date()) {
      throw new AppError('This promo code has expired', 400);
    }

    if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
      throw new AppError('This promo code has reached its usage limit', 400);
    }

    if (orderAmount < promo.minOrderAmount!) {
      throw new AppError(`Minimum order amount of ${promo.minOrderAmount} required`, 400);
    }

    if (promo.restaurant && promo.restaurant.toString() !== restaurantId) {
      throw new AppError('This promo code is not valid for this restaurant', 400);
    }

    // Calculate discount
    let discount = (promo.discountPercentage / 100) * orderAmount;
    if (promo.maxDiscountAmount && discount > promo.maxDiscountAmount) {
      discount = promo.maxDiscountAmount;
    }

    res.status(200).json({
      status: 'success',
      data: {
        discountAmount: discount,
        newTotal: orderAmount - discount,
      },
    });
  });
}

export default new PromoController();
