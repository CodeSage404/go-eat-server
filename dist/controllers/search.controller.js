"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
const foodItem_model_1 = __importDefault(require("../models/foodItem.model"));
const catchAsync_1 = require("../utils/catchAsync");
class SearchController {
    constructor() {
        /**
         * Unified search across Restaurants, Food Items, and Cuisines
         */
        this.globalSearch = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { q, lat, lng, cuisine } = req.query;
            const query = q;
            // 1. Search for Restaurants matching name or cuisine
            const restaurantQuery = { status: 'active' };
            if (query) {
                restaurantQuery.$or = [
                    { name: { $regex: query, $options: 'i' } },
                    { cuisine: { $regex: query, $options: 'i' } }
                ];
            }
            if (cuisine) {
                restaurantQuery.cuisine = { $regex: cuisine, $options: 'i' };
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
            const restaurants = await restaurant_model_1.default.find(restaurantQuery).limit(20);
            // 2. Search for Food Items matching the name (e.g., searching "Jollof")
            let foodItems = [];
            if (query) {
                foodItems = await foodItem_model_1.default.find({
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
        this.getPopularCuisines = (0, catchAsync_1.catchAsync)(async (req, res) => {
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
    }
}
exports.default = new SearchController();
