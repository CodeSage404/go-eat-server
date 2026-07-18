"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const google_maps_services_js_1 = require("@googlemaps/google-maps-services-js");
const logger_1 = __importDefault(require("../utils/logger"));
const client = new google_maps_services_js_1.Client({});
class GoogleMapsService {
    constructor() {
        this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    }
    /**
     * Calculate distance and time between two points
     */
    async getDistanceAndTime(origin, destination) {
        try {
            if (!this.apiKey) {
                logger_1.default.warn('⚠️ Google Maps API Key missing. Returning estimated values.');
                return { distance: '5 km', duration: '15 mins' };
            }
            const response = await client.distancematrix({
                params: {
                    origins: [`${origin[1]},${origin[0]}`], // lat,lng
                    destinations: [`${destination[1]},${destination[0]}`],
                    mode: google_maps_services_js_1.TravelMode.driving,
                    key: this.apiKey,
                },
            });
            if (response.data.rows[0].elements[0].status === 'OK') {
                const element = response.data.rows[0].elements[0];
                return {
                    distance: element.distance.text,
                    duration: element.duration.text,
                    distanceValue: element.distance.value, // in meters
                    durationValue: element.duration.value, // in seconds
                };
            }
            throw new Error('Could not calculate distance');
        }
        catch (error) {
            logger_1.default.error('❌ Google Maps Distance Matrix Error:', error);
            return { distance: 'N/A', duration: 'N/A' };
        }
    }
    /**
     * Geocode an address to coordinates
     */
    async geocodeAddress(address) {
        try {
            if (!this.apiKey)
                throw new Error('API Key missing');
            const response = await client.geocode({
                params: {
                    address,
                    key: this.apiKey,
                },
            });
            if (response.data.results.length > 0) {
                const location = response.data.results[0].geometry.location;
                return [location.lng, location.lat]; // [lng, lat]
            }
            return null;
        }
        catch (error) {
            logger_1.default.error('❌ Google Maps Geocoding Error:', error);
            return null;
        }
    }
    /**
     * Get autocomplete suggestions restricted to Nigeria
     */
    async getPlaceAutocomplete(input) {
        try {
            if (!this.apiKey)
                return [];
            const response = await client.placeAutocomplete({
                params: {
                    input,
                    key: this.apiKey,
                    components: ['country:ng'],
                },
            });
            return response.data.predictions;
        }
        catch (error) {
            logger_1.default.error('❌ Google Maps Autocomplete Error:', error);
            return [];
        }
    }
}
exports.default = new GoogleMapsService();
