import Restaurant, { IRestaurant, RestaurantStatus } from '../models/restaurant.model';
import FoodItem from '../models/foodItem.model';
import Promo from '../models/promo.model';
import mongoose from 'mongoose';
import { buildCountryFilter } from '../utils/locationResolver';

class RestaurantService {
  /**
   * Helper to attach live promo status, promo text, and active promos to restaurants
   */
  private async attachLivePromoDetails(restaurants: any[]): Promise<any[]> {
    if (!restaurants || restaurants.length === 0) return restaurants;

    const restIds = restaurants
      .map(r => r._id || r.id)
      .filter(id => id && mongoose.isValidObjectId(id));

    if (restIds.length === 0) return restaurants;

    try {
      const [foodWithDiscounts, activePromos] = await Promise.all([
        FoodItem.find({
          restaurant: { $in: restIds },
          $or: [
            { discountPercentage: { $gt: 0 } },
            { originalPrice: { $exists: true, $ne: null } }
          ]
        }).select('restaurant discountPercentage price originalPrice'),
        Promo.find({
          restaurant: { $in: restIds },
          isActive: true,
        }).select('restaurant code discountPercentage maxDiscountAmount minOrderAmount')
      ]);

      const discountMap = new Map<string, number>();
      foodWithDiscounts.forEach(f => {
        const rId = f.restaurant?.toString();
        if (!rId) return;
        let pct = f.discountPercentage || 0;
        if (!pct && f.originalPrice && f.originalPrice > f.price) {
          pct = Math.round(((f.originalPrice - f.price) / f.originalPrice) * 100);
        }
        const currentMax = discountMap.get(rId) || 0;
        if (pct > currentMax) discountMap.set(rId, pct);
      });

      const promoMap = new Map<string, any[]>();
      activePromos.forEach(p => {
        const rId = p.restaurant?.toString();
        if (!rId) return;
        const list = promoMap.get(rId) || [];
        list.push(p);
        promoMap.set(rId, list);
        const currentMax = discountMap.get(rId) || 0;
        if (p.discountPercentage > currentMax) discountMap.set(rId, p.discountPercentage);
      });

      return restaurants.map(r => {
        const doc = typeof r.toObject === 'function' ? r.toObject() : { ...r };
        const rId = (doc._id || doc.id)?.toString();
        const maxDiscount = rId ? (discountMap.get(rId) || 0) : 0;
        const attachedPromos = rId ? (promoMap.get(rId) || []) : [];

        const hasLivePromo = maxDiscount > 0 || attachedPromos.length > 0;
        const effectiveHasPromo = Boolean(doc.hasPromo || hasLivePromo);

        let effectivePromoText = doc.promoText;
        if (!effectivePromoText || effectivePromoText.trim().length === 0) {
          if (attachedPromos.length > 0 && attachedPromos[0]?.code) {
            effectivePromoText = `${attachedPromos[0].discountPercentage}% OFF with ${attachedPromos[0].code}`;
          } else if (maxDiscount > 0) {
            effectivePromoText = `Up to ${maxDiscount}% OFF`;
          }
        }

        const mergedPromos = Array.isArray(doc.promos) && doc.promos.length > 0 
          ? doc.promos 
          : attachedPromos;

        return {
          ...doc,
          hasPromo: effectiveHasPromo,
          acceptsPromos: Boolean(doc.acceptsPromos || attachedPromos.length > 0),
          promoText: effectivePromoText || '',
          promos: mergedPromos,
        };
      });
    } catch (err) {
      console.warn('Error attaching live promo details to restaurants:', err);
      return restaurants;
    }
  }

  /**
   * Create a new restaurant
   */
  async createRestaurant(data: Partial<IRestaurant>): Promise<IRestaurant> {
    const payload = { ...data };
    const cCode = String(payload.countryCode || payload.address?.countryCode || '').toUpperCase();
    const cName = String(payload.country || payload.address?.country || '').toLowerCase();

    if (cCode === 'GB' || cCode === 'UK' || cName.includes('united kingdom') || cName.includes('britain') || cName.includes('england')) {
      payload.countryCode = 'GB';
      payload.country = 'United Kingdom';
      payload.baseCurrency = payload.baseCurrency || 'GBP';
      payload.isUk = true;
      payload.isNigeria = false;
      payload.isItaly = false;
    } else if (cCode === 'IT' || cName.includes('italy') || cName.includes('italia')) {
      payload.countryCode = 'IT';
      payload.country = 'Italy';
      payload.baseCurrency = payload.baseCurrency || 'EUR';
      payload.isItaly = true;
      payload.isNigeria = false;
      payload.isUk = false;
    } else if (cCode === 'NG' || cName.includes('nigeria')) {
      payload.countryCode = 'NG';
      payload.country = 'Nigeria';
      payload.baseCurrency = payload.baseCurrency || 'NGN';
      payload.isNigeria = true;
      payload.isUk = false;
      payload.isItaly = false;
    }
    return await Restaurant.create(payload);
  }

  /**
   * Get all restaurants with filters
   */
  async getAllRestaurants(filters: any = {}): Promise<any[]> {
    const query: any = { status: RestaurantStatus.ACTIVE };

    // Country / Location filter
    if (filters.country || filters.countryCode) {
      const countryFilter = buildCountryFilter(filters.country, filters.countryCode);
      if (countryFilter.$or && countryFilter.$or.length > 0) {
        query.$and = query.$and || [];
        query.$and.push(countryFilter);
      }
    }

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

    // Sponsored filter
    if (filters.isSponsored) {
      query.isSponsored = true;
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

    const restaurants = await Restaurant.find(query).sort(sortQuery);
    const augmented = await this.attachLivePromoDetails(restaurants);

    if (filters.shuffle && !filters.sort && augmented.length > 1) {
      return this.shuffleRestaurants(augmented);
    }

    return augmented;
  }

  /**
   * Helper to perform a randomized Fisher-Yates shuffle on a restaurant array,
   * keeping sponsored restaurants prioritized at the top (shuffled amongst themselves).
   */
  public shuffleRestaurants(restaurants: any[]): any[] {
    if (!restaurants || restaurants.length <= 1) return restaurants;

    const sponsored: any[] = [];
    const regular: any[] = [];

    for (const r of restaurants) {
      if (r.isSponsored) {
        sponsored.push(r);
      } else {
        regular.push(r);
      }
    }

    const shuffleArray = (arr: any[]) => {
      const cloned = [...arr];
      for (let i = cloned.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
      }
      return cloned;
    };

    return [...shuffleArray(sponsored), ...shuffleArray(regular)];
  }

  /**
   * Find nearby restaurants using GeoJSON
   */
  async findNearbyRestaurants(
    lng: number,
    lat: number,
    maxDistanceInMeters: number = 5000,
    countryFilters?: { country?: string; countryCode?: string },
    options: { sort?: string; shuffle?: boolean } = {}
  ): Promise<any[]> {
    const geoQuery: any = { status: RestaurantStatus.ACTIVE };
    if (countryFilters?.country || countryFilters?.countryCode) {
      const countryFilter = buildCountryFilter(countryFilters.country, countryFilters.countryCode);
      if (countryFilter.$or && countryFilter.$or.length > 0) {
        geoQuery.$or = countryFilter.$or;
      }
    }

    const results = await Restaurant.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'calculatedDistance', // Distance in meters
          maxDistance: maxDistanceInMeters,
          query: geoQuery,
          spherical: true
        }
      }
    ]);

    // Dynamic Delivery Time Algorithm
    // Assume average speed of 40 km/h (which is ~11.1 m/s or 666 m/min).
    // Let's say it takes 1 minute for every 666 meters.
    // Base preparation time: 15 minutes.
    // Total delivery time = (distance_in_meters / 666) + 15
    const mappedResults = results.map(restaurant => {
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

    const augmented = await this.attachLivePromoDetails(mappedResults);

    // Apply explicit sorting if provided by client
    if (options.sort) {
      if (options.sort === 'Rating') {
        augmented.sort((a, b) => ((b.ratingsAverage || b.rating || 0) - (a.ratingsAverage || a.rating || 0)));
      } else if (options.sort === 'Delivery time') {
        augmented.sort((a, b) => ((a.estimatedDeliveryTime || 0) - (b.estimatedDeliveryTime || 0)));
      } else if (options.sort === 'Delivery fee') {
        augmented.sort((a, b) => ((a.deliveryFee || 0) - (b.deliveryFee || 0)));
      } else if (options.sort === 'Distance') {
        augmented.sort((a, b) => ((a.calculatedDistance || 0) - (b.calculatedDistance || 0)));
      }
      return augmented;
    }

    // Default: Shuffle nearby outlets for dynamic exposure across user sessions
    if (options.shuffle !== false && augmented.length > 1) {
      return this.shuffleRestaurants(augmented);
    }

    return augmented;
  }

  /**
   * Get restaurant by ID
   */
  async getRestaurantById(id: string): Promise<any | null> {
    const restaurant = await Restaurant.findById(id).populate('owner', 'name email profileImage');
    if (!restaurant) return null;
    const [augmented] = await this.attachLivePromoDetails([restaurant]);
    return augmented || restaurant;
  }

  /**
   * Update restaurant
   */
  async updateRestaurant(id: string, data: Partial<IRestaurant>): Promise<IRestaurant | null> {
    return await Restaurant.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true });
  }

  /**
   * Delete (deactivate) restaurant
   */
  async deleteRestaurant(id: string): Promise<IRestaurant | null> {
    return await Restaurant.findByIdAndUpdate(id, { status: RestaurantStatus.INACTIVE }, { returnDocument: 'after' });
  }
}

/**
 * Synchronize live promo fields directly on a restaurant in MongoDB
 */
export async function syncRestaurantPromoStatus(restaurantId: string | mongoose.Types.ObjectId): Promise<void> {
  if (!restaurantId || !mongoose.isValidObjectId(restaurantId)) return;
  try {
    const [foodWithDiscounts, activePromos] = await Promise.all([
      FoodItem.find({
        restaurant: restaurantId,
        $or: [
          { discountPercentage: { $gt: 0 } },
          { originalPrice: { $exists: true, $ne: null } }
        ]
      }).select('discountPercentage price originalPrice'),
      Promo.find({
        restaurant: restaurantId,
        isActive: true,
      }).select('code discountPercentage')
    ]);

    let maxDiscount = 0;
    foodWithDiscounts.forEach(f => {
      let pct = f.discountPercentage || 0;
      if (!pct && f.originalPrice && f.originalPrice > f.price) {
        pct = Math.round(((f.originalPrice - f.price) / f.originalPrice) * 100);
      }
      if (pct > maxDiscount) maxDiscount = pct;
    });

    activePromos.forEach(p => {
      if (p.discountPercentage > maxDiscount) maxDiscount = p.discountPercentage;
    });

    const hasPromo = foodWithDiscounts.length > 0 || activePromos.length > 0;
    const promoText = maxDiscount > 0 
      ? `Up to ${maxDiscount}% OFF` 
      : (activePromos[0]?.code ? `${activePromos[0].discountPercentage}% OFF with ${activePromos[0].code}` : '');

    await Restaurant.findByIdAndUpdate(restaurantId, {
      hasPromo,
      acceptsPromos: activePromos.length > 0,
      ...(promoText ? { promoText } : {})
    });
  } catch (err) {
    console.warn('Error syncing restaurant promo status:', err);
  }
}

/**
 * Synchronize live promo status across all restaurants in MongoDB (useful on startup or migration)
 */
export async function syncAllRestaurantsPromoStatus(): Promise<void> {
  try {
    const [foodRestIds, promoRestIds] = await Promise.all([
      FoodItem.distinct('restaurant', {
        $or: [
          { discountPercentage: { $gt: 0 } },
          { originalPrice: { $exists: true, $ne: null } }
        ]
      }),
      Promo.distinct('restaurant', { isActive: true })
    ]);

    const allRestIds = Array.from(new Set([
      ...foodRestIds.map(id => id?.toString()),
      ...promoRestIds.map(id => id?.toString())
    ])).filter(id => id && mongoose.isValidObjectId(id));

    for (const restId of allRestIds) {
      await syncRestaurantPromoStatus(restId);
    }
  } catch (err) {
    console.warn('Error syncing all restaurants promo status:', err);
  }
}

export default new RestaurantService();

