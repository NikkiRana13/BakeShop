/**
 * The only code in the app that talks to the network. Each call tries the
 * vendor-search server and, if it is off, slow or errors, falls back to
 * sample data — so vendor search can never crash or hang the app. `live`
 * says which one Grandma is looking at.
 */
import {
  demoMarketTypes,
  DEMO_LEADS,
} from '../data/demoVendors';
import { ExtractedQuote, parseQuoteLocally } from '../logic/quoteParser';
import { BakeryProfile, BaseUnit, MarketType, VendorLead } from '../types';
import { API_BASE_URL, USE_LIVE_API } from './config';

export interface Fetched<T> {
  data: T;
  live: boolean;
}

const HEALTH_TIMEOUT_MS = 2500;
const VENDORS_TIMEOUT_MS = 15000;
/** Web research reads several pages, so it can take a while. */
const RESEARCH_TIMEOUT_MS = 45000;
const EXTRACT_TIMEOUT_MS = 20000;

async function request<T>(
  path: string,
  body: object | null,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Server answered ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** A quick check first, so a server that is off fails in seconds, not 45. */
async function serverReady(): Promise<boolean> {
  if (!USE_LIVE_API) {
    return false;
  }
  try {
    const h = await request<{ ok: boolean }>('/health', null, HEALTH_TIMEOUT_MS);
    return h.ok === true;
  } catch {
    return false;
  }
}

export async function researchIngredient(input: {
  query: string;
  reason?: string;
  profile: BakeryProfile;
}): Promise<Fetched<MarketType[]>> {
  if (await serverReady()) {
    try {
      const res = await request<{ types: MarketType[] }>(
        '/research',
        { query: input.query, reason: input.reason, city: input.profile.city },
        RESEARCH_TIMEOUT_MS,
      );
      if (Array.isArray(res.types) && res.types.length > 0) {
        return { data: res.types, live: true };
      }
    } catch {
      // Fall through to sample data.
    }
  }
  return { data: demoMarketTypes(input.query), live: false };
}

export async function findVendors(input: {
  query: string;
  profile: BakeryProfile;
}): Promise<Fetched<VendorLead[]>> {
  if (await serverReady()) {
    try {
      const res = await request<{ vendors: VendorLead[] }>(
        '/vendors',
        { query: input.query, lat: input.profile.lat, lng: input.profile.lng },
        VENDORS_TIMEOUT_MS,
      );
      if (Array.isArray(res.vendors) && res.vendors.length > 0) {
        return { data: res.vendors, live: true };
      }
    } catch {
      // Fall through to sample data.
    }
  }
  return { data: DEMO_LEADS, live: false };
}

export async function extractQuote(input: {
  emailText: string;
  ingredientName: string;
  unit: BaseUnit;
}): Promise<Fetched<ExtractedQuote>> {
  if (await serverReady()) {
    try {
      const res = await request<ExtractedQuote>(
        '/extract-quote',
        input,
        EXTRACT_TIMEOUT_MS,
      );
      if (typeof res.found === 'boolean') {
        return { data: res, live: true };
      }
    } catch {
      // Fall through to the offline reader.
    }
  }
  return { data: parseQuoteLocally(input.emailText), live: false };
}
