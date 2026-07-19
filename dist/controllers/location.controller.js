"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const maps_service_1 = __importDefault(require("../services/maps.service"));
const nigeriaLocations_1 = require("../utils/nigeriaLocations");
class LocationController {
    constructor() {
        /**
         * Returns a list of all states in Nigeria using the nigeriaLocations library module
         */
        this.getNigeriaStates = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const states = (0, nigeriaLocations_1.getStates)();
            res.status(200).json({
                status: 'success',
                data: {
                    states
                }
            });
        });
        /**
         * Suggests place/address predictions using either the Google Maps Library Autocomplete API
         * (restricted to Nigeria) or falls back to our local nigeriaLocations library matching states & LGAs.
         */
        this.autocomplete = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { query } = req.query;
            if (!query || typeof query !== 'string') {
                throw new appError_1.default('Search query parameter is required', 400);
            }
            let predictions = [];
            try {
                // 1. Try fetching real predictions using Google Maps Library restricted to Nigeria country
                const googleResults = await maps_service_1.default.getPlaceAutocomplete(query);
                if (googleResults && googleResults.length > 0) {
                    predictions = googleResults.map((p) => ({
                        description: p.description,
                        placeId: p.place_id,
                        coordinates: [3.3792, 6.5244] // Default placeholder, resolved by client geocode later
                    }));
                }
            }
            catch (err) {
                // Log error but proceed to local library fallback
                console.warn('Google Maps Autocomplete failed, falling back to local library database:', err);
            }
            // 2. If Google results are empty, fall back to matching local Nigeria States & LGAs library database
            if (predictions.length === 0) {
                const localMatches = (0, nigeriaLocations_1.searchNigeriaLocations)(query);
                predictions = localMatches.map(description => ({
                    description,
                    placeId: `local_${description.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
                    coordinates: [3.3792, 6.5244] // default to Lagos coordinates
                }));
            }
            res.status(200).json({
                status: 'success',
                data: {
                    predictions
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
                const apiKey = process.env.GOOGLE_MAPS_API_KEY;
                if (apiKey) {
                    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
                    const data = (await response.json());
                    if (data.results && data.results.length > 0) {
                        address = data.results[0].formatted_address;
                    }
                }
            }
            catch (err) {
                console.warn('Google Maps Geocoding failed, trying Nominatim fallback:', err.message);
            }
            // Fallback to Nominatim (OpenStreetMap) for high-precision address resolution (zero key required)
            if (address === 'Nigeria' || !address) {
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2`, {
                        headers: {
                            'User-Agent': 'GoEatApp/1.0 (support@goeatone.com)',
                            'Accept': 'application/json',
                        }
                    });
                    const rawText = await response.text();
                    if (rawText && rawText.startsWith('{')) {
                        const data = JSON.parse(rawText);
                        if (data && data.display_name) {
                            address = data.display_name;
                        }
                    }
                }
                catch (nominatimErr) {
                    console.warn('Nominatim Geocoding fallback failed:', nominatimErr.message);
                    address = `Coordinates: ${lat}, ${lng}`;
                }
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
