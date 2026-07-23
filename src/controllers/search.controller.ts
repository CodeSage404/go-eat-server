import { Request, Response } from 'express';
import Restaurant from '../models/restaurant.model';
import FoodItem from '../models/foodItem.model';
import { catchAsync } from '../utils/catchAsync';

class SearchController {
  /**
   * Unified search across Restaurants, Food Items, and Cuisines
   */
  public globalSearch = catchAsync(async (req: Request, res: Response) => {
    const { q, lat, lng, cuisine } = req.query;
    const query = q as string;

    // 1. Search for Restaurants matching name or cuisine
    const restaurantQuery: any = { status: 'active' };
    if (query) {
      restaurantQuery.$or = [
        { name: { $regex: query, $options: 'i' } },
        { cuisine: { $regex: query, $options: 'i' } }
      ];
    }
    if (cuisine) {
      restaurantQuery.cuisine = { $regex: cuisine as string, $options: 'i' };
    }

    // Handle Geospatial search if coordinates provided
    if (lat && lng) {
      restaurantQuery.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [Number(lat), Number(lng)],
          },
          $maxDistance: 10000, // 10km radius
        },
      };
    }

    const restaurants = await Restaurant.find(restaurantQuery).limit(20);

    // 2. Search for Food Items matching the name (e.g., searching "Jollof")
    let foodItems: any[] = [];
    if (query) {
      foodItems = await FoodItem.find({
        name: { $regex: query, $options: 'i' },
        isAvailable: true
      })
      .populate('restaurant', 'name location ratingsAverage deliveryFee estimatedDeliveryTime')
      .limit(20);
    }

    res.status(200).json({
      status: 'success',
      data: {
        restaurants,
        foodItems,
        resultsCount: restaurants.length + foodItems.length
      },
    });
  });

  /**
   * List all popular Nigerian Cuisines for the filter chips
   */
  public getPopularCuisines = catchAsync(async (req: Request, res: Response) => {
    const cuisines = [
      'Jollof & Fried Rice',
      'Swallow & Soups',
      'Afro-fusion',
      'Continental',
      'Grills & Suya',
      'Pastries & Breakfast',
      'Healthy & Salads',
      'Drinks & Deserts'
    ];
    
    res.status(200).json({
      status: 'success',
      data: { cuisines },
    });
  });
  /**
   * List trending/top searches
   */
  public getTopSearches = catchAsync(async (req: Request, res: Response) => {
    const topSearches = [
      'Jollof Rice',
      'Shawarma',
      'Suya',
      'Amala',
      'Fried Rice',
      'Burger',
      'Pizza'
    ];
    
    res.status(200).json({
      status: 'success',
      data: { topSearches },
    });
  });
}

export default new SearchController();
