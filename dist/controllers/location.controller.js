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
         * Suggests place/address predictions using:
         * 1. Google Maps Library Autocomplete API
         * 2. OpenStreetMap Nominatim Places Search API (fallback)
         * 3. Local nigeriaLocations library matching states & LGAs (fallback)
         */
        this.autocomplete = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { query } = req.query;
            if (!query || typeof query !== 'string') {
                throw new appError_1.default('Search query parameter is required', 400);
            }
            let predictions = [];
            // 1. Try Google Maps Place Autocomplete
            try {
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
                // Ignore Google error
            }
            // 2. Fallback to OpenStreetMap Nominatim Search API for Nigeria
            if (predictions.length === 0) {
                try {
                    const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=ng&format=jsonv2&limit=8`, {
                        headers: {
                            'User-Agent': 'GoEatApp/1.0 (support@goeatone.com)',
                            'Accept': 'application/json',
                        }
                    });
                    const rawText = await nomRes.text();
                    if (rawText && rawText.startsWith('[')) {
                        const nomData = JSON.parse(rawText);
                        if (Array.isArray(nomData) && nomData.length > 0) {
                            predictions = nomData.map((item) => ({
                                description: item.display_name,
                                placeId: `nom_${item.place_id}`,
                                coordinates: [Number(item.lon), Number(item.lat)]
                            }));
                        }
                    }
                }
                catch (nomErr) {
                    // Ignore fallback error
                }
            }
            // 3. Fallback to local nigeriaLocations library matching states & LGAs
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
         * Resolves precise address (e.g. "Agbani, Enugu, Nigeria") and never returns plain "Nigeria"
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
            let address = '';
            // 1. Try Google Maps Reverse Geocoding
            try {
                const apiKey = process.env.GOOGLE_MAPS_API_KEY;
                if (apiKey) {
                    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
                    const data = (await response.json());
                    if (data.results && data.results.length > 0) {
                        const formatted = data.results[0].formatted_address;
                        if (formatted && formatted.toLowerCase() !== 'nigeria') {
                            address = formatted;
                        }
                    }
                }
            }
            catch (err) {
                // Fallback
            }
            // 2. Fallback to Nominatim (OpenStreetMap) for high-precision address resolution
            if (!address || address.toLowerCase() === 'nigeria') {
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
                    // Fallback
                }
            }
            // 3. Guarantee precise fallback address format if still empty
            if (!address || address.toLowerCase() === 'nigeria') {
                address = `Precise Location (${lat.toFixed(4)}, ${lng.toFixed(4)}), Nigeria`;
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
