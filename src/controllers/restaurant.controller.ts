import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import restaurantService from '../services/restaurant.service';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import Restaurant, { RestaurantStatus } from '../models/restaurant.model';

const daySchedule = z.object({
  isOpen: z.boolean(),
  open: z.string(),
  close: z.string(),
});

const openingHoursSchema = z.object({
  Monday: daySchedule,
  Tuesday: daySchedule,
  Wednesday: daySchedule,
  Thursday: daySchedule,
  Friday: daySchedule,
  Saturday: daySchedule,
  Sunday: daySchedule,
});

const restaurantSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  description: z.string().min(10, 'Description is too short'),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
  }),
  location: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()]), // [lng, lat]
  }),
  cuisine: z.array(z.string()).optional(),
  isSponsored: z.boolean().optional(),
  isTopSpot: z.boolean().optional(),
  openingHours: openingHoursSchema,
});

const vendorUpdateRestaurantSchema = z.object({
  name: z.string().min(2, 'Name is too short').optional(),
  description: z.string().min(10, 'Description is too short').optional(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
  }).optional(),
  location: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()]), 
  }).optional(),
  cuisine: z.array(z.string()).optional(),
  openingHours: openingHoursSchema.optional(),
  images: z.object({
    logo: z.string().optional(),
    cover: z.string().optional(),
  }).optional(),
  businessPhone: z.string().optional(),
  businessEmail: z.string().email().optional(),
  businessWebsite: z.string().optional(),
  tradingName: z.string().optional(),
  businessCategory: z.string().optional(),
  bankDetails: z.object({
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
    accountName: z.string().optional(),
  }).optional(),
});

class RestaurantController {
  /**
   * Create a new restaurant (For Vendors)
   */
  public createRestaurant = catchAsync(async (req: any, res: Response) => {
    const validatedData = restaurantSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError(validatedData.error.issues.map(i => i.message).join(', '), 400);
    }

    const restaurant = await restaurantService.createRestaurant({
      ...req.body,
      owner: req.user._id, // Assuming req.user is populated by auth middleware
    });

    res.status(201).json({
      status: 'success',
      data: { restaurant },
    });
  });

  /**
   * Get all active restaurants with optional filters
   */
  public getAllRestaurants = catchAsync(async (req: Request, res: Response) => {
    const { cuisine, search, lat, lng, dist, isTopSpot, tags, sort } = req.query;

    let restaurants;

    if (lat && lng) {
      // Find nearby if lat/lng are provided
      restaurants = await restaurantService.findNearbyRestaurants(
        parseFloat(lng as string),
        parseFloat(lat as string),
        dist ? parseInt(dist as string) : 5000
      );
    } else {
      restaurants = await restaurantService.getAllRestaurants({ 
        cuisine, 
        search, 
        isTopSpot: isTopSpot === 'true',
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
        sort: sort as string
      });
    }

    res.status(200).json({
      status: 'success',
      results: restaurants.length,
      data: { restaurants },
    });
  });

  /**
   * Get a single restaurant by ID
   */
  public getRestaurantById = catchAsync(async (req: Request, res: Response) => {
    const restaurant = await restaurantService.getRestaurantById(req.params.id as string);

    if (!restaurant) {
      throw new AppError('No restaurant found with that ID', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { restaurant },
    });
  });

  /**
   * Get logged in vendor's restaurant
   */
  public getMyRestaurant = catchAsync(async (req: any, res: Response) => {
    const restaurant = await Restaurant.findOne({ owner: req.user._id }).populate('owner', 'name email profileImage');

    if (!restaurant) {
      throw new AppError('No restaurant profile found for this user', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { restaurant },
    });
  });

  /**
   * Update logged in vendor's restaurant
   */
  public updateMyRestaurant = catchAsync(async (req: any, res: Response) => {
    const restaurant = await Restaurant.findOne({ owner: req.user._id });

    if (!restaurant) {
      throw new AppError('No restaurant profile found for this user', 404);
    }

    const validatedData = vendorUpdateRestaurantSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new AppError(validatedData.error.issues.map(i => i.message).join(', '), 400);
    }

    // validatedData.data now only contains the fields allowed in vendorUpdateRestaurantSchema
    // all extra fields (like status, isTopSpot, popularityScore) have been stripped out.
    const updatedRestaurant = await restaurantService.updateRestaurant(
      restaurant._id.toString(), 
      validatedData.data as any
    );

    res.status(200).json({
      status: 'success',
      data: { restaurant: updatedRestaurant },
    });
  });

  /**
   * Update restaurant profile
   */
  public updateRestaurant = catchAsync(async (req: any, res: Response) => {
    // Check if the user is the owner (In a real app, use a middleware for this)
    const restaurant = await restaurantService.getRestaurantById(req.params.id as string);
    
    if (!restaurant) {
      throw new AppError('No restaurant found with that ID', 404);
    }

    if (restaurant.owner._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      throw new AppError('You do not have permission to perform this action', 403);
    }

    // We apply the strict vendor schema to strip unapproved fields if it is a vendor updating their own profile.
    // If it's an admin, we could allow more fields, but for safety, we'll apply it here too unless we want 
    // admins to be able to bypass it. Assuming we only want basic edits here.
    let updateData = req.body;
    if (req.user.role !== 'admin') {
      const validatedData = vendorUpdateRestaurantSchema.safeParse(req.body);
      if (!validatedData.success) {
        throw new AppError(validatedData.error.issues.map(i => i.message).join(', '), 400);
      }
      updateData = validatedData.data;
    }

    const updatedRestaurant = await restaurantService.updateRestaurant(req.params.id as string, updateData);

    res.status(200).json({
      status: 'success',
      data: { restaurant: updatedRestaurant },
    });
  });

  /**
   * Deactivate restaurant
   */
  public deleteRestaurant = catchAsync(async (req: any, res: Response) => {
    const restaurant = await restaurantService.getRestaurantById(req.params.id as string);

    if (!restaurant) {
      throw new AppError('No restaurant found with that ID', 404);
    }

    if (restaurant.owner._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      throw new AppError('You do not have permission to perform this action', 403);
    }

    await restaurantService.deleteRestaurant(req.params.id as string);

    res.status(204).json({
      status: 'success',
      data: null,
    });
  });

  /**
   * Migrate and ensure promo fields on all existing restaurants
   */
  public migratePromoFields = catchAsync(async (req: Request, res: Response) => {
    const result = await Restaurant.updateMany(
      { $or: [{ hasPromo: { $exists: false } }, { acceptsPromos: { $exists: false } }] },
      { $set: { hasPromo: false, acceptsPromos: false, allowStampCards: false, promoText: '' } }
    );

    res.status(200).json({
      status: 'success',
      message: 'Successfully migrated promo fields across all restaurants',
      data: {
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount,
      },
    });
  });
}

export default new RestaurantController();
