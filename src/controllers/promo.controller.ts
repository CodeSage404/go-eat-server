import { Request, Response } from 'express';
import Promo from '../models/promo.model';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';

class PromoController {
  /**
   * Admin/Vendor: Create a new promotion
   */
  public createPromo = catchAsync(async (req: Request, res: Response) => {
    // If vendor, bind promo to their restaurant
    if (req.user!.role === 'vendor') {
      req.body.restaurant = req.user!._id; // Realistically should be the restaurant ID they own, but simplifying for now.
    }

    const promo = await Promo.create(req.body);

    res.status(201).json({
      status: 'success',
      data: { promo },
    });
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
