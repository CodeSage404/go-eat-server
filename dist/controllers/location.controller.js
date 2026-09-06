"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const maps_service_1 = __importDefault(require("../services/maps.service"));
const nigeriaLocations_1 = require("../utils/nigeriaLocations");
const user_model_1 = __importDefault(require("../models/user.model"));
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
            let country = 'Nigeria';
            let countryCode = 'NG';
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
                        const countryComp = data.results[0].address_components?.find((c) => c.types?.includes('country'));
                        if (countryComp) {
                            if (countryComp.short_name === 'IT' || countryComp.long_name === 'Italy') {
                                country = 'Italy';
                                countryCode = 'IT';
                            }
                            else if (countryComp.short_name === 'GB' ||
                                countryComp.short_name === 'UK' ||
                                countryComp.long_name?.includes('United Kingdom')) {
                                country = 'UK';
                                countryCode = 'UK';
                            }
                            else if (countryComp.short_name === 'NG' || countryComp.long_name === 'Nigeria') {
                                country = 'Nigeria';
                                countryCode = 'NG';
                            }
                            else {
                                country = 'Other';
                                countryCode = countryComp.short_name || 'OT';
                            }
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
                        if (data && data.address) {
                            const nomCountry = (data.address.country || '').toLowerCase();
                            const nomCode = (data.address.country_code || '').toLowerCase();
                            if (nomCode === 'it' || nomCountry.includes('italy') || nomCountry.includes('italia')) {
                                country = 'Italy';
                                countryCode = 'IT';
                            }
                            else if (nomCode === 'gb' || nomCode === 'uk' || nomCountry.includes('united kingdom')) {
                                country = 'UK';
                                countryCode = 'UK';
                            }
                            else if (nomCode === 'ng' || nomCountry.includes('nigeria')) {
                                country = 'Nigeria';
                                countryCode = 'NG';
                            }
                            else if (nomCountry) {
                                country = 'Other';
                                countryCode = nomCode ? nomCode.toUpperCase() : 'OT';
                            }
                        }
                    }
                }
                catch (nominatimErr) {
                    // Fallback
                }
            }
            // 3. Coordinate bounding box fallback if country not resolved by API
            if (country === 'Nigeria' && countryCode === 'NG' && address) {
                const lowerAddr = address.toLowerCase();
                if (lowerAddr.includes('italy') || lowerAddr.includes('italia')) {
                    country = 'Italy';
                    countryCode = 'IT';
                }
                else if (lowerAddr.includes('united kingdom') ||
                    lowerAddr.includes('uk') ||
                    lowerAddr.includes('england') ||
                    lowerAddr.includes('london')) {
                    country = 'UK';
                    countryCode = 'UK';
                }
                else if (lat >= 36.0 && lat <= 47.5 && lng >= 6.5 && lng <= 18.5) {
                    country = 'Italy';
                    countryCode = 'IT';
                }
                else if (lat >= 49.5 && lat <= 61.0 && lng >= -8.5 && lng <= 2.0) {
                    country = 'UK';
                    countryCode = 'UK';
                }
            }
            // 4. Guarantee precise fallback address format if still empty
            if (!address || address.toLowerCase() === 'nigeria') {
                if (country === 'Italy') {
                    address = `Precise Location (${lat.toFixed(4)}, ${lng.toFixed(4)}), Italy`;
                }
                else if (country === 'UK') {
                    address = `Precise Location (${lat.toFixed(4)}, ${lng.toFixed(4)}), UK`;
                }
                else {
                    address = `Precise Location (${lat.toFixed(4)}, ${lng.toFixed(4)}), Nigeria`;
                }
            }
            const isNigeria = country === 'Nigeria';
            const isItaly = country === 'Italy';
            const isUk = country === 'UK';
            res.status(200).json({
                status: 'success',
                data: {
                    address,
                    coords: { latitude: lat, longitude: lng },
                    country,
                    countryCode,
                    isNigeria,
                    isItaly,
                    isUk,
                },
            });
        });
        /**
         * Detects user's country from request IP address
         * Returns targetRoute ('ng', 'it', or 'uk') for coming-soons web app redirection
         */
        this.detectIpCountry = (0, catchAsync_1.catchAsync)(async (req, res) => {
            let clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                req.socket.remoteAddress ||
                req.ip ||
                '';
            if (clientIp.startsWith('::ffff:')) {
                clientIp = clientIp.replace('::ffff:', '');
            }
            let countryCode = 'UK';
            let country = 'United Kingdom';
            let targetRoute = 'uk';
            const isLocalIp = !clientIp ||
                clientIp === '::1' ||
                clientIp === '127.0.0.1' ||
                clientIp.startsWith('192.168.') ||
                clientIp.startsWith('10.') ||
                clientIp.startsWith('172.16.');
            if (!isLocalIp) {
                try {
                    const response = await fetch(`https://ipapi.co/${clientIp}/json/`, {
                        headers: { 'User-Agent': 'GoEatApp/1.0' },
                    });
                    const data = (await response.json());
                    if (data && data.country_code) {
                        countryCode = data.country_code.toUpperCase();
                        country = data.country_name || countryCode;
                    }
                }
                catch (err) {
                    try {
                        const fallbackRes = await fetch(`http://ip-api.com/json/${clientIp}`);
                        const fallbackData = (await fallbackRes.json());
                        if (fallbackData && fallbackData.countryCode) {
                            countryCode = fallbackData.countryCode.toUpperCase();
                            country = fallbackData.country || countryCode;
                        }
                    }
                    catch (fErr) {
                        // Ignore fallback error
                    }
                }
            }
            if (countryCode === 'NG') {
                targetRoute = 'ng';
                country = 'Nigeria';
            }
            else if (countryCode === 'IT') {
                targetRoute = 'it';
                country = 'Italy';
            }
            else if (countryCode === 'GB' || countryCode === 'UK') {
                targetRoute = 'uk';
                country = 'United Kingdom';
                countryCode = 'UK';
            }
            else {
                targetRoute = 'uk';
            }
            const isNigeria = targetRoute === 'ng';
            const isItaly = targetRoute === 'it';
            const isUk = targetRoute === 'uk';
            res.status(200).json({
                status: 'success',
                data: {
                    ip: clientIp,
                    country,
                    countryCode,
                    targetRoute,
                    isNigeria,
                    isItaly,
                    isUk,
                },
            });
        });
        /**
         * Updates authenticated user's (rider, driver, or customer) live GPS coordinates and online status
         */
        this.updateLocation = (0, catchAsync_1.catchAsync)(async (req, res) => {
            if (!req.user) {
                throw new appError_1.default('You are not logged in! Please log in to get access.', 401);
            }
            const { coordinates, heading, speed } = req.body;
            if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
                throw new appError_1.default('Valid [longitude, latitude] coordinates are required', 400);
            }
            const [lng, lat] = coordinates.map(Number);
            if (isNaN(lng) || isNaN(lat)) {
                throw new appError_1.default('Invalid coordinates format', 400);
            }
            await user_model_1.default.findByIdAndUpdate(req.user._id, {
                location: {
                    type: 'Point',
                    coordinates: [lng, lat],
                },
                isOnline: true,
            });
            res.status(200).json({
                status: 'success',
                message: 'Location updated successfully',
                data: {
                    coordinates: [lng, lat],
                    heading,
                    speed,
                },
            });
        });
        /**
         * Calculates route distance and driving duration between origin and destination coordinates
         */
        this.getDistance = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { origin, destination } = req.body;
            if (!origin || !destination || !Array.isArray(origin) || !Array.isArray(destination)) {
                throw new appError_1.default('Origin and destination [longitude, latitude] coordinates are required', 400);
            }
            const result = await maps_service_1.default.getDistanceAndTime([Number(origin[0]), Number(origin[1])], [Number(destination[0]), Number(destination[1])]);
            res.status(200).json({
                status: 'success',
                data: {
                    distanceText: result.distance || '0 km',
                    durationText: result.duration || '0 mins',
                    distanceValue: result.distanceValue || 0,
                    durationValue: result.durationValue || 0,
                },
            });
        });
    }
}
exports.default = new LocationController();
