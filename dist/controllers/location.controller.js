"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const maps_service_1 = __importDefault(require("../services/maps.service"));
const NIGERIA_STATES = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe',
    'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
    'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
    'Taraba', 'Yobe', 'Zamfara'
];
class LocationController {
    constructor() {
        /**
         * Returns a list of all states in Nigeria
         */
        this.getNigeriaStates = (0, catchAsync_1.catchAsync)(async (req, res) => {
            res.status(200).json({
                status: 'success',
                data: {
                    states: NIGERIA_STATES
                }
            });
        });
        /**
         * Geocodes or suggests place suggestions based on search text (query input)
         */
        this.autocomplete = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { query } = req.query;
            if (!query || typeof query !== 'string') {
                throw new appError_1.default('Search query parameter is required', 400);
            }
            // Optional: Query Google Geocoding or return matching states/regions
            const coordinates = await maps_service_1.default.geocodeAddress(query);
            // We can simulate autocomplete suggestions based on match
            const suggestions = NIGERIA_STATES.filter(state => state.toLowerCase().includes(query.toLowerCase())).map(state => ({
                description: `${state}, Nigeria`,
                placeId: `state_${state.toLowerCase()}`,
                coordinates: coordinates || [3.3792, 6.5244] // default to Lagos if geocode fails
            }));
            res.status(200).json({
                status: 'success',
                data: {
                    predictions: suggestions
                }
            });
        });
        /**
         * Detects location by reverse geocoding coordinates (latitude and longitude)
         */
        this.detectLocation = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { latitude, longitude } = req.query;
            if (!latitude || !longitude) {
                throw new appError_1.default('Latitude and longitude are required', 400);
            }
            const lat = Number(latitude);
            const lng = Number(longitude);
            if (isNaN(lat) || isNaN(lng)) {
                throw new appError_1.default('Invalid coordinates format', 400);
            }
            // Call reverse geocoding
            let address = 'Nigeria';
            try {
                // If we have Google Maps API, it will use that, or return default
                const apiKey = process.env.GOOGLE_MAPS_API_KEY;
                if (apiKey) {
                    // Fetch reverse geocode via Client API if needed, or fallback
                    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
                    const data = (await response.json());
                    if (data.results && data.results.length > 0) {
                        address = data.results[0].formatted_address;
                    }
                }
                else {
                    address = `Coordinates: ${lat}, ${lng} (Nigeria)`;
                }
            }
            catch (err) {
                address = `Coordinates: ${lat}, ${lng}`;
            }
            res.status(200).json({
                status: 'success',
                data: {
                    address,
                    coords: { latitude: lat, longitude: lng }
                }
            });
        });
    }
}
exports.default = new LocationController();
