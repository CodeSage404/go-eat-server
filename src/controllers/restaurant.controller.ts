import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import restaurantService from '../services/restaurant.service';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import { RestaurantStatus } from '../models/restaurant.model';

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
  openingHours: z.object({
    open: z.string(),
    close: z.string(),
  }),
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
    const { cuisine, search, lat, lng, dist, isTopSpot } = req.query;

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
        isTopSpot: isTopSpot === 'true' 
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

    const updatedRestaurant = await restaurantService.updateRestaurant(req.params.id as string, req.body);

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
}

export default new RestaurantController();
