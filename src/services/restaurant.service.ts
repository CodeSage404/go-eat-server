import Restaurant, { IRestaurant, RestaurantStatus } from '../models/restaurant.model';
import mongoose from 'mongoose';

class RestaurantService {
  /**
   * Create a new restaurant
   */
  async createRestaurant(data: Partial<IRestaurant>): Promise<IRestaurant> {
    return await Restaurant.create(data);
  }

  /**
   * Get all restaurants with filters
   */
  async getAllRestaurants(filters: any = {}): Promise<IRestaurant[]> {
    const query: any = { status: RestaurantStatus.ACTIVE };

    // Cuisine filter
    if (filters.cuisine) {
      query.cuisine = { $in: Array.isArray(filters.cuisine) ? filters.cuisine : [filters.cuisine] };
    }

    // Search filter
    if (filters.search) {
      query.name = { $regex: filters.search, $options: 'i' };
    }

    // Top Spot filter
    if (filters.isTopSpot) {
      query.isTopSpot = true;
    }

    // Custom tag filters
    if (filters.tags && Array.isArray(filters.tags)) {
      if (filters.tags.includes('Free delivery')) query.deliveryFee = 0;
      if (filters.tags.includes('Discounts')) query.discount = { $gt: 0 };
    }

    // Custom sorting
    let sortQuery: any = { popularityScore: -1, ratingsAverage: -1 };
    if (filters.sort) {
      if (filters.sort === 'Rating') sortQuery = { ratingsAverage: -1 };
      else if (filters.sort === 'Delivery time') sortQuery = { estimatedDeliveryTime: 1 };
      else if (filters.sort === 'Delivery fee') sortQuery = { deliveryFee: 1 };
    }

    return await Restaurant.find(query).sort(sortQuery);
  }

  /**
   * Find nearby restaurants using GeoJSON
   */
  async findNearbyRestaurants(lng: number, lat: number, maxDistanceInMeters: number = 5000): Promise<any[]> {
    const results = await Restaurant.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'calculatedDistance', // Distance in meters
          maxDistance: maxDistanceInMeters,
          query: { status: RestaurantStatus.ACTIVE },
          spherical: true
        }
      }
    ]);

    // Dynamic Delivery Time Algorithm
    // Assume average speed of 40 km/h (which is ~11.1 m/s or 666 m/min).
    // Let's say it takes 1 minute for every 666 meters.
    // Base preparation time: 15 minutes.
    // Total delivery time = (distance_in_meters / 666) + 15
    return results.map(restaurant => {
      const distanceInMeters = restaurant.calculatedDistance || 0;
      const travelTimeMinutes = Math.ceil(distanceInMeters / 666);
      const prepTimeMinutes = 15;
      
      return {
        ...restaurant,
        estimatedDeliveryTime: travelTimeMinutes + prepTimeMinutes,
        // Also ensure id mapping for frontend compatibility
        id: restaurant._id,
      };
    });
  }

  /**
   * Get restaurant by ID
   */
  async getRestaurantById(id: string): Promise<IRestaurant | null> {
    return await Restaurant.findById(id).populate('owner', 'name email profileImage');
  }

  /**
   * Update restaurant
   */
  async updateRestaurant(id: string, data: Partial<IRestaurant>): Promise<IRestaurant | null> {
    return await Restaurant.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  /**
   * Delete (deactivate) restaurant
   */
  async deleteRestaurant(id: string): Promise<IRestaurant | null> {
    return await Restaurant.findByIdAndUpdate(id, { status: RestaurantStatus.INACTIVE }, { new: true });
  }
}

export default new RestaurantService();
