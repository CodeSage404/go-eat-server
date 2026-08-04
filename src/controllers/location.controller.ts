import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import mapsService from '../services/maps.service';
import { getStates, searchNigeriaLocations } from '../utils/nigeriaLocations';

class LocationController {
  /**
   * Returns a list of all states in Nigeria using the nigeriaLocations library module
   */
  public getNigeriaStates = catchAsync(async (req: Request, res: Response) => {
    const states = getStates();
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
  public autocomplete = catchAsync(async (req: Request, res: Response) => {
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
      throw new AppError('Search query parameter is required', 400);
    }

    let predictions: Array<{ description: string; placeId: string; coordinates: [number, number] }> = [];

    // 1. Try Google Maps Place Autocomplete
    try {
      const googleResults = await mapsService.getPlaceAutocomplete(query);
      if (googleResults && googleResults.length > 0) {
        predictions = googleResults.map((p: any) => ({
          description: p.description,
          placeId: p.place_id,
          coordinates: [3.3792, 6.5244] // Default placeholder, resolved by client geocode later
        }));
      }
    } catch (err) {
      // Ignore Google error
    }

    // 2. Fallback to OpenStreetMap Nominatim Search API for Nigeria
    if (predictions.length === 0) {
      try {
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=ng&format=jsonv2&limit=8`,
          {
            headers: {
              'User-Agent': 'GoEatApp/1.0 (support@goeatone.com)',
              'Accept': 'application/json',
            }
          }
        );
        const rawText = await nomRes.text();
        if (rawText && rawText.startsWith('[')) {
          const nomData = JSON.parse(rawText);
          if (Array.isArray(nomData) && nomData.length > 0) {
            predictions = nomData.map((item: any) => ({
              description: item.display_name,
              placeId: `nom_${item.place_id}`,
              coordinates: [Number(item.lon), Number(item.lat)]
            }));
          }
        }
      } catch (nomErr) {
        // Ignore fallback error
      }
    }

    // 3. Fallback to local nigeriaLocations library matching states & LGAs
    if (predictions.length === 0) {
      const localMatches = searchNigeriaLocations(query);
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
  public detectLocation = catchAsync(async (req: Request, res: Response) => {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      throw new AppError('Latitude and longitude are required', 400);
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      throw new AppError('Invalid coordinates format', 400);
    }

    let address = '';
    let country = 'Nigeria';
    let countryCode = 'NG';

    // 1. Try Google Maps Reverse Geocoding
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
        );
        const data = (await response.json()) as any;
        if (data.results && data.results.length > 0) {
          const formatted = data.results[0].formatted_address;
          if (formatted && formatted.toLowerCase() !== 'nigeria') {
            address = formatted;
          }
          const countryComp = data.results[0].address_components?.find((c: any) =>
            c.types?.includes('country')
          );
          if (countryComp) {
            if (countryComp.short_name === 'IT' || countryComp.long_name === 'Italy') {
              country = 'Italy';
              countryCode = 'IT';
            } else if (
              countryComp.short_name === 'GB' ||
              countryComp.short_name === 'UK' ||
              countryComp.long_name?.includes('United Kingdom')
            ) {
              country = 'UK';
              countryCode = 'UK';
            } else if (countryComp.short_name === 'NG' || countryComp.long_name === 'Nigeria') {
              country = 'Nigeria';
              countryCode = 'NG';
            } else {
              country = 'Other';
              countryCode = countryComp.short_name || 'OT';
            }
          }
        }
      }
    } catch (err: any) {
      // Fallback
    }

    // 2. Fallback to Nominatim (OpenStreetMap) for high-precision address resolution
    if (!address || address.toLowerCase() === 'nigeria') {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2`,
          {
            headers: {
              'User-Agent': 'GoEatApp/1.0 (support@goeatone.com)',
              'Accept': 'application/json',
            }
          }
        );
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
            } else if (nomCode === 'gb' || nomCode === 'uk' || nomCountry.includes('united kingdom')) {
              country = 'UK';
              countryCode = 'UK';
            } else if (nomCode === 'ng' || nomCountry.includes('nigeria')) {
              country = 'Nigeria';
              countryCode = 'NG';
            } else if (nomCountry) {
              country = 'Other';
              countryCode = nomCode ? nomCode.toUpperCase() : 'OT';
            }
          }
        }
      } catch (nominatimErr: any) {
        // Fallback
      }
    }

    // 3. Coordinate bounding box fallback if country not resolved by API
    if (country === 'Nigeria' && countryCode === 'NG' && address) {
      const lowerAddr = address.toLowerCase();
      if (lowerAddr.includes('italy') || lowerAddr.includes('italia')) {
        country = 'Italy';
        countryCode = 'IT';
      } else if (
        lowerAddr.includes('united kingdom') ||
        lowerAddr.includes('uk') ||
        lowerAddr.includes('england') ||
        lowerAddr.includes('london')
      ) {
        country = 'UK';
        countryCode = 'UK';
      } else if (lat >= 36.0 && lat <= 47.5 && lng >= 6.5 && lng <= 18.5) {
        country = 'Italy';
        countryCode = 'IT';
      } else if (lat >= 49.5 && lat <= 61.0 && lng >= -8.5 && lng <= 2.0) {
        country = 'UK';
        countryCode = 'UK';
      }
    }

    // 4. Guarantee precise fallback address format if still empty
    if (!address || address.toLowerCase() === 'nigeria') {
      if (country === 'Italy') {
        address = `Precise Location (${lat.toFixed(4)}, ${lng.toFixed(4)}), Italy`;
      } else if (country === 'UK') {
        address = `Precise Location (${lat.toFixed(4)}, ${lng.toFixed(4)}), UK`;
      } else {
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
}

export default new LocationController();
