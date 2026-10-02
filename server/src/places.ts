/**
 * Nearby stores from Google Places API (New) Text Search. Deliberately dumb:
 * it fetches and normalizes. The app decides which stores make good picks,
 * so live results and its sample data go through the same logic.
 */
import { HttpError } from './http.js';

/** Same shape as VendorLead in the app (BakeShop/src/types.ts). */
export interface VendorLead {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  distanceKm: number;
  placeTypes: string[];
  rating?: number;
  reviewCount?: number;
  openNow?: boolean;
}

interface Place {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean };
}

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.location',
  'places.types',
  'places.rating',
  'places.userRatingCount',
  'places.currentOpeningHours.openNow',
].join(',');

export const SEARCH_RADIUS_KM = 15;
const MAX_LEADS = 20;

/** Straight-line distance in km between two points. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

async function textSearch(
  apiKey: string,
  textQuery: string,
  center: { lat: number; lng: number },
): Promise<Place[]> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      pageSize: 20,
      // Text Search only restricts to rectangles, so bias toward a circle
      // around the bakery and drop far-away results below.
      locationBias: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius: SEARCH_RADIUS_KM * 1000,
        },
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new HttpError(502, `Google Places answered ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { places?: Place[] };
  return json.places ?? [];
}

/**
 * Three searches at once so every kind of store shows up: regular grocers,
 * bulk and wholesale stores, and farms or farmers' markets.
 */
export async function findVendors(input: {
  query: string;
  lat: number;
  lng: number;
}): Promise<VendorLead[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, 'GOOGLE_MAPS_API_KEY is not set.');
  }
  const center = { lat: input.lat, lng: input.lng };
  const q = input.query.trim();
  const queries = [`${q} grocery store`, `${q} bulk wholesale store`, `${q} farm farmers market`];
  const settled = await Promise.allSettled(queries.map(t => textSearch(apiKey, t, center)));
  const ok = settled.filter(
    (s): s is PromiseFulfilledResult<Place[]> => s.status === 'fulfilled',
  );
  if (ok.length === 0) {
    const first = settled[0] as PromiseRejectedResult;
    throw first.reason instanceof HttpError
      ? first.reason
      : new HttpError(502, 'Google Places could not be reached.');
  }

  const byId = new Map<string, VendorLead>();
  for (const place of ok.flatMap(s => s.value)) {
    if (!place.id || !place.location || byId.has(place.id)) {
      continue;
    }
    const distanceKm = haversineKm(center, {
      lat: place.location.latitude,
      lng: place.location.longitude,
    });
    if (distanceKm > SEARCH_RADIUS_KM) {
      continue;
    }
    byId.set(place.id, {
      placeId: place.id,
      name: place.displayName?.text ?? 'Unnamed store',
      address: place.formattedAddress ?? '',
      phone: place.nationalPhoneNumber,
      website: place.websiteUri,
      distanceKm: Math.round(distanceKm * 10) / 10,
      placeTypes: place.types ?? [],
      rating: place.rating,
      reviewCount: place.userRatingCount,
      openNow: place.currentOpeningHours?.openNow,
    });
  }
  return [...byId.values()]
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, MAX_LEADS);
}
