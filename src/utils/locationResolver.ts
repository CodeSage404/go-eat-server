import { Request } from 'express';

export interface ResolvedLocation {
  country?: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
}

/**
 * Resolves the client's country, country code, and geographic coordinates
 * from request query params, custom headers, authenticated user profile, or coordinate bounding boxes.
 */
export function resolveRequestLocation(req: Request): ResolvedLocation {
  const queryCountry = (req.query.country as string) || (req.query.region as string);
  const queryCountryCode = (req.query.countryCode as string) || (req.query.regionCode as string);
  const headerCountry = (req.headers['x-country'] as string) || (req.headers['x-region'] as string);
  const headerCountryCode = (req.headers['x-country-code'] as string) || (req.headers['x-region-code'] as string);
  
  const user = (req as any).user;
  const userCountry = user?.country;
  const userCountryCode = user?.countryCode;

  const rawCountry = queryCountry || headerCountry || userCountry || '';
  const rawCode = queryCountryCode || headerCountryCode || userCountryCode || '';

  // Parse coordinates
  const rawLat = req.query.lat || req.query.latitude || req.headers['x-latitude'] || user?.location?.coordinates?.[1];
  const rawLng = req.query.lng || req.query.longitude || req.headers['x-longitude'] || user?.location?.coordinates?.[0];

  const lat = rawLat !== undefined && rawLat !== null && !isNaN(Number(rawLat)) ? Number(rawLat) : undefined;
  const lng = rawLng !== undefined && rawLng !== null && !isNaN(Number(rawLng)) ? Number(rawLng) : undefined;

  let resolvedCountry: string | undefined;
  let resolvedCountryCode: string | undefined;

  const cLower = rawCountry.toLowerCase().trim();
  const codeUpper = rawCode.toUpperCase().trim();

  if (
    codeUpper === 'UK' ||
    codeUpper === 'GB' ||
    cLower.includes('united kingdom') ||
    cLower.includes('england') ||
    cLower.includes('london') ||
    cLower === 'uk'
  ) {
    resolvedCountry = 'UK';
    resolvedCountryCode = 'UK';
  } else if (
    codeUpper === 'IT' ||
    cLower.includes('italy') ||
    cLower.includes('italia') ||
    cLower.includes('rome') ||
    cLower.includes('milan')
  ) {
    resolvedCountry = 'Italy';
    resolvedCountryCode = 'IT';
  } else if (
    codeUpper === 'NG' ||
    cLower.includes('nigeria') ||
    cLower.includes('lagos') ||
    cLower.includes('enugu') ||
    cLower.includes('abuja')
  ) {
    resolvedCountry = 'Nigeria';
    resolvedCountryCode = 'NG';
  } else if (lat !== undefined && lng !== undefined) {
    // Coordinate Bounding Box Inference
    if (lat >= 49.5 && lat <= 61.0 && lng >= -8.5 && lng <= 2.0) {
      resolvedCountry = 'UK';
      resolvedCountryCode = 'UK';
    } else if (lat >= 36.0 && lat <= 47.5 && lng >= 6.5 && lng <= 18.5) {
      resolvedCountry = 'Italy';
      resolvedCountryCode = 'IT';
    } else if (lat >= 4.0 && lat <= 14.0 && lng >= 2.5 && lng <= 15.0) {
      resolvedCountry = 'Nigeria';
      resolvedCountryCode = 'NG';
    }
  }

  // If user explicitly sent a country name that is not one of the top 3, preserve it
  if (!resolvedCountry && rawCountry.trim()) {
    resolvedCountry = rawCountry.trim();
    resolvedCountryCode = codeUpper || 'OT';
  }

  return {
    country: resolvedCountry,
    countryCode: resolvedCountryCode,
    lat,
    lng,
  };
}

/**
 * Builds a MongoDB query fragment to match documents by country or countryCode.
 */
export function buildCountryFilter(country?: string, countryCode?: string): Record<string, any> {
  if (!country && !countryCode) return {};

  const orConditions: any[] = [];
  const cLower = (country || '').toLowerCase().trim();
  const codeUpper = (countryCode || '').toUpperCase().trim();

  if (
    cLower === 'uk' ||
    cLower === 'united kingdom' ||
    codeUpper === 'GB' ||
    codeUpper === 'UK'
  ) {
    orConditions.push({ country: { $regex: /^(United Kingdom|UK)$/i } });
    orConditions.push({ 'address.country': { $regex: /^(United Kingdom|UK)$/i } });
    orConditions.push({ countryCode: { $regex: /^(GB|UK)$/i } });
    orConditions.push({ 'address.countryCode': { $regex: /^(GB|UK)$/i } });
    orConditions.push({ isUk: true });
  } else if (
    cLower === 'italy' ||
    cLower === 'italia' ||
    codeUpper === 'IT'
  ) {
    orConditions.push({ country: { $regex: /^(Italy|Italia)$/i } });
    orConditions.push({ 'address.country': { $regex: /^(Italy|Italia)$/i } });
    orConditions.push({ countryCode: { $regex: /^IT$/i } });
    orConditions.push({ 'address.countryCode': { $regex: /^IT$/i } });
    orConditions.push({ isItaly: true });
  } else if (
    cLower === 'nigeria' ||
    codeUpper === 'NG'
  ) {
    orConditions.push({ country: { $regex: /^Nigeria$/i } });
    orConditions.push({ 'address.country': { $regex: /^Nigeria$/i } });
    orConditions.push({ countryCode: { $regex: /^NG$/i } });
    orConditions.push({ 'address.countryCode': { $regex: /^NG$/i } });
    orConditions.push({ isNigeria: true });
    orConditions.push({ country: { $exists: false } });
    orConditions.push({ country: null });
    orConditions.push({ country: '' });
  } else {
    if (country) {
      orConditions.push({ country: { $regex: new RegExp(`^${country}$`, 'i') } });
      orConditions.push({ 'address.country': { $regex: new RegExp(`^${country}$`, 'i') } });
    }
    if (countryCode) {
      orConditions.push({ countryCode: { $regex: new RegExp(`^${countryCode}$`, 'i') } });
      orConditions.push({ 'address.countryCode': { $regex: new RegExp(`^${countryCode}$`, 'i') } });
    }
  }

  return orConditions.length > 0 ? { $or: orConditions } : {};
}
