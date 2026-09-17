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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const restaurant_model_1 = __importStar(require("../models/restaurant.model"));
const foodItem_model_1 = __importDefault(require("../models/foodItem.model"));
const catchAsync_1 = require("../utils/catchAsync");
const locationResolver_1 = require("../utils/locationResolver");
class SearchController {
    constructor() {
        /**
         * Unified search across Restaurants, Food Items, and Cuisines
         */
        this.globalSearch = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { q, cuisine } = req.query;
            const { country, countryCode, lat, lng } = (0, locationResolver_1.resolveRequestLocation)(req);
            const query = q;
            const countryFilter = (0, locationResolver_1.buildCountryFilter)(country, countryCode);
            // 1. Search for Restaurants matching name or cuisine
            const restaurantQuery = { status: restaurant_model_1.RestaurantStatus.ACTIVE, ...countryFilter };
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
            const restaurants = await restaurant_model_1.default.find(restaurantQuery).limit(20);
            // 2. Search for Food Items matching the name (filtered to active restaurants in this country)
            let foodItems = [];
            if (query) {
                // Constrain food items to restaurants in this country
                const activeRestInCountry = await restaurant_model_1.default.find({ status: restaurant_model_1.RestaurantStatus.ACTIVE, ...countryFilter }).select('_id');
                const activeRestIds = activeRestInCountry.map((r) => r._id);
                const foodItemQuery = {
                    name: { $regex: query, $options: 'i' },
                    isAvailable: true,
                };
                if (activeRestIds.length > 0 || country || countryCode) {
                    foodItemQuery.restaurant = { $in: activeRestIds };
                }
                foodItems = await foodItem_model_1.default.find(foodItemQuery)
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
        this.getPopularCuisines = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { country, countryCode } = (0, locationResolver_1.resolveRequestLocation)(req);
            const code = (countryCode || '').toUpperCase();
            const cName = (country || '').toLowerCase();
            let cuisines;
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
            }
            else if (code === 'IT' || cName.includes('ital')) {
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
            }
            else {
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
        this.getTopSearches = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { country, countryCode } = (0, locationResolver_1.resolveRequestLocation)(req);
            const code = (countryCode || '').toUpperCase();
            const cName = (country || '').toLowerCase();
            let topSearches;
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
            }
            else if (code === 'IT' || cName.includes('ital')) {
                topSearches = [
                    'Pizza Margherita',
                    'Carbonara',
                    'Cacio e Pepe',
                    'Tiramisù',
                    'Gelato',
                    'Lasagna',
                    'Risotto'
                ];
            }
            else {
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
}
exports.default = new SearchController();
