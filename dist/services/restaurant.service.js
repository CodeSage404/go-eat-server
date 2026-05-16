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
        return await restaurant_model_1.default.find(query);
    }
    /**
     * Find nearby restaurants using GeoJSON
     */
    async findNearbyRestaurants(lng, lat, maxDistanceInMeters = 5000) {
        return await restaurant_model_1.default.find({
            status: restaurant_model_1.RestaurantStatus.ACTIVE,
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
