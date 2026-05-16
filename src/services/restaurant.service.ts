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

    return await Restaurant.find(query);
  }

  /**
   * Find nearby restaurants using GeoJSON
   */
  async findNearbyRestaurants(lng: number, lat: number, maxDistanceInMeters: number = 5000): Promise<IRestaurant[]> {
    return await Restaurant.find({
      status: RestaurantStatus.ACTIVE,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          $maxDistance: maxDistanceInMeters,
        },
      },
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
