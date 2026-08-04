"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const restaurant_model_1 = __importStar(require("../models/restaurant.model"));
class RestaurantService {
    /**
     * Create a new restaurant
     */
    async createRestaurant(data) {
        return await restaurant_model_1.default.create(data);
    }
    /**
     * Get all restaurants with filters
     */
    async getAllRestaurants(filters = {}) {
        const query = { status: restaurant_model_1.RestaurantStatus.ACTIVE };
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
            if (filters.tags.includes('Free delivery'))
                query.deliveryFee = 0;
            if (filters.tags.includes('Discounts'))
                query.discount = { $gt: 0 };
        }
        // Custom sorting
        let sortQuery = { popularityScore: -1, ratingsAverage: -1 };
        if (filters.sort) {
            if (filters.sort === 'Rating')
                sortQuery = { ratingsAverage: -1 };
            else if (filters.sort === 'Delivery time')
                sortQuery = { estimatedDeliveryTime: 1 };
            else if (filters.sort === 'Delivery fee')
                sortQuery = { deliveryFee: 1 };
        }
        return await restaurant_model_1.default.find(query).sort(sortQuery);
    }
    /**
     * Find nearby restaurants using GeoJSON
     */
    async findNearbyRestaurants(lng, lat, maxDistanceInMeters = 5000) {
        const results = await restaurant_model_1.default.aggregate([
            {
                $geoNear: {
                    near: { type: 'Point', coordinates: [lng, lat] },
                    distanceField: 'calculatedDistance', // Distance in meters
                    maxDistance: maxDistanceInMeters,
                    query: { status: restaurant_model_1.RestaurantStatus.ACTIVE },
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
    async getRestaurantById(id) {
        return await restaurant_model_1.default.findById(id).populate('owner', 'name email profileImage');
    }
    /**
     * Update restaurant
     */
    async updateRestaurant(id, data) {
        return await restaurant_model_1.default.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    }
    /**
     * Delete (deactivate) restaurant
     */
    async deleteRestaurant(id) {
        return await restaurant_model_1.default.findByIdAndUpdate(id, { status: restaurant_model_1.RestaurantStatus.INACTIVE }, { new: true });
    }
}
exports.default = new RestaurantService();
