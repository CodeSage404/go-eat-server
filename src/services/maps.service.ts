import { Client, TravelMode } from '@googlemaps/google-maps-services-js';
import logger from '../utils/logger';

const client = new Client({});

class GoogleMapsService {
  private apiKey: string = process.env.GOOGLE_MAPS_API_KEY || '';

  /**
   * Calculate distance and time between two points
   */
  async getDistanceAndTime(origin: [number, number], destination: [number, number]) {
    try {
      if (!this.apiKey) {
        logger.warn('⚠️ Google Maps API Key missing. Returning estimated values.');
        return { distance: '5 km', duration: '15 mins' };
      }

      const response = await client.distancematrix({
        params: {
          origins: [`${origin[1]},${origin[0]}`], // lat,lng
          destinations: [`${destination[1]},${destination[0]}`],
          mode: TravelMode.driving,
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
    } catch (error) {
      logger.error('❌ Google Maps Distance Matrix Error:', error);
      return { distance: 'N/A', duration: 'N/A' };
    }
  }

  /**
   * Geocode an address to coordinates
   */
  async geocodeAddress(address: string) {
    try {
      if (!this.apiKey) throw new Error('API Key missing');

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
    } catch (error) {
      logger.error('❌ Google Maps Geocoding Error:', error);
      return null;
    }
  }
}

export default new GoogleMapsService();
