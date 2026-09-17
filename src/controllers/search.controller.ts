import { Request, Response } from 'express';
import Restaurant, { RestaurantStatus } from '../models/restaurant.model';
import FoodItem from '../models/foodItem.model';
import { catchAsync } from '../utils/catchAsync';
import { resolveRequestLocation, buildCountryFilter } from '../utils/locationResolver';

class SearchController {
  /**
   * Unified search across Restaurants, Food Items, and Cuisines
   */
  public globalSearch = catchAsync(async (req: Request, res: Response) => {
    const { q, cuisine } = req.query;
    const { country, countryCode, lat, lng } = resolveRequestLocation(req);
    const query = q as string;

    const countryFilter = buildCountryFilter(country, countryCode);

    // 1. Search for Restaurants matching name or cuisine
    const restaurantQuery: any = { status: RestaurantStatus.ACTIVE, ...countryFilter };
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
    if (lat !== undefined && lng !== undefined) {
      restaurantQuery.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [Number(lng), Number(lat)], // GeoJSON is [lng, lat]
          },
          $maxDistance: 25000, // 25km radius
        },
      };
    }

    const restaurants = await Restaurant.find(restaurantQuery).limit(20);

    // 2. Search for Food Items matching the name (filtered to active restaurants in this country)
    let foodItems: any[] = [];
    if (query) {
      // Constrain food items to restaurants in this country
      const activeRestInCountry = await Restaurant.find({ status: RestaurantStatus.ACTIVE, ...countryFilter }).select('_id');
      const activeRestIds = activeRestInCountry.map((r) => r._id);

      const foodItemQuery: any = {
        name: { $regex: query, $options: 'i' },
        isAvailable: true,
      };

      if (activeRestIds.length > 0 || country || countryCode) {
        foodItemQuery.restaurant = { $in: activeRestIds };
      }

      foodItems = await FoodItem.find(foodItemQuery)
        .populate('restaurant', 'name location ratingsAverage deliveryFee estimatedDeliveryTime country countryCode address')
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
   * List popular cuisines for the filter chips based on user country
   */
  public getPopularCuisines = catchAsync(async (req: Request, res: Response) => {
    const { country, countryCode } = resolveRequestLocation(req);
    const code = (countryCode || '').toUpperCase();
    const cName = (country || '').toLowerCase();

    let cuisines: string[];
    if (code === 'GB' || code === 'UK' || cName.includes('kingdom') || cName.includes('britain')) {
      cuisines = [
        'Fish & Chips',
        'Sunday Roast',
        'British Pub Fare',
        'Indian & Curry',
        'Asian & Katsu',
        'Burgers & Fries',
        'Italian & Pasta',
        'Breakfast & Brunch'
      ];
    } else if (code === 'IT' || cName.includes('ital')) {
      cuisines = [
        'Pasta & Primi',
        'Pizza Napoletana',
        'Trattoria & Antipasti',
        'Secondi & Carne',
        'Gelato & Dolci',
        'Panini & Focaccia',
        'Seafood',
        'Caffè & Colazione'
      ];
    } else {
      // Default: Nigeria
      cuisines = [
        'Jollof & Fried Rice',
        'Swallow & Soups',
        'Afro-fusion',
        'Continental',
        'Grills & Suya',
        'Pastries & Breakfast',
        'Healthy & Salads',
        'Drinks & Deserts'
      ];
    }
    
    res.status(200).json({
      status: 'success',
      data: { cuisines },
    });
  });

  /**
   * List trending/top searches based on user country
   */
  public getTopSearches = catchAsync(async (req: Request, res: Response) => {
    const { country, countryCode } = resolveRequestLocation(req);
    const code = (countryCode || '').toUpperCase();
    const cName = (country || '').toLowerCase();

    let topSearches: string[];
    if (code === 'GB' || code === 'UK' || cName.includes('kingdom') || cName.includes('britain')) {
      topSearches = [
        'Fish and Chips',
        'Sunday Roast',
        'Chicken Tikka Masala',
        'Burger',
        'Pizza',
        'Katsu Curry',
        'Full English'
      ];
    } else if (code === 'IT' || cName.includes('ital')) {
      topSearches = [
        'Pizza Margherita',
        'Carbonara',
        'Cacio e Pepe',
        'Tiramisù',
        'Gelato',
        'Lasagna',
        'Risotto'
      ];
    } else {
      // Default: Nigeria
      topSearches = [
        'Jollof Rice',
        'Shawarma',
        'Suya',
        'Amala',
        'Fried Rice',
        'Burger',
        'Pizza'
      ];
    }
    
    res.status(200).json({
      status: 'success',
      data: { topSearches },
    });
  });
}

export default new SearchController();
