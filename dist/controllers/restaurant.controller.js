"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const restaurant_service_1 = __importDefault(require("../services/restaurant.service"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const restaurantSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name is too short'),
    description: zod_1.z.string().min(10, 'Description is too short'),
    address: zod_1.z.object({
        street: zod_1.z.string(),
        city: zod_1.z.string(),
        state: zod_1.z.string(),
        zipCode: zod_1.z.string(),
    }),
    location: zod_1.z.object({
        type: zod_1.z.literal('Point'),
        coordinates: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number()]), // [lng, lat]
    }),
    cuisine: zod_1.z.array(zod_1.z.string()).optional(),
    openingHours: zod_1.z.object({
        open: zod_1.z.string(),
        close: zod_1.z.string(),
    }),
});
class RestaurantController {
    constructor() {
        /**
         * Create a new restaurant (For Vendors)
         */
        this.createRestaurant = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const validatedData = restaurantSchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default(validatedData.error.issues.map(i => i.message).join(', '), 400);
            }
            const restaurant = await restaurant_service_1.default.createRestaurant({
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
        this.getAllRestaurants = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { cuisine, search, lat, lng, dist, isTopSpot, tags, sort } = req.query;
            let restaurants;
            if (lat && lng) {
                // Find nearby if lat/lng are provided
                restaurants = await restaurant_service_1.default.findNearbyRestaurants(parseFloat(lng), parseFloat(lat), dist ? parseInt(dist) : 5000);
            }
            else {
                restaurants = await restaurant_service_1.default.getAllRestaurants({
                    cuisine,
                    search,
                    isTopSpot: isTopSpot === 'true',
                    tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
                    sort: sort
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
        this.getRestaurantById = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const restaurant = await restaurant_service_1.default.getRestaurantById(req.params.id);
            if (!restaurant) {
                throw new appError_1.default('No restaurant found with that ID', 404);
            }
            res.status(200).json({
                status: 'success',
                data: { restaurant },
            });
        });
        /**
         * Update restaurant profile
         */
        this.updateRestaurant = (0, catchAsync_1.catchAsync)(async (req, res) => {
            // Check if the user is the owner (In a real app, use a middleware for this)
            const restaurant = await restaurant_service_1.default.getRestaurantById(req.params.id);
            if (!restaurant) {
                throw new appError_1.default('No restaurant found with that ID', 404);
            }
            if (restaurant.owner._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
                throw new appError_1.default('You do not have permission to perform this action', 403);
            }
            const updatedRestaurant = await restaurant_service_1.default.updateRestaurant(req.params.id, req.body);
            res.status(200).json({
                status: 'success',
                data: { restaurant: updatedRestaurant },
            });
        });
        /**
         * Deactivate restaurant
         */
        this.deleteRestaurant = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const restaurant = await restaurant_service_1.default.getRestaurantById(req.params.id);
            if (!restaurant) {
                throw new appError_1.default('No restaurant found with that ID', 404);
            }
            if (restaurant.owner._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
                throw new appError_1.default('You do not have permission to perform this action', 403);
            }
            await restaurant_service_1.default.deleteRestaurant(req.params.id);
            res.status(204).json({
                status: 'success',
                data: null,
            });
        });
    }
}
exports.default = new RestaurantController();
