/**
 * Telling chain stores apart from local, independent ones.
 *
 * Google Places has no "is a chain" flag, so this is a heuristic: a name on a
 * list of well-known chains, or a name that shows up several times in one
 * search (many branches nearby). It can be wrong in both directions, which is
 * why Grandma always sees the store's name and address before contacting it.
 */
import { VendorLead } from '../types';

/** Canadian and North American grocery chains, written as they appear on signs. */
const CHAIN_NAMES = [
  'Loblaws',
  'Real Canadian Superstore',
  'No Frills',
  'Your Independent Grocer',
  'Zehrs',
  'Fortinos',
  'Valu-mart',
  'Provigo',
  'Maxi',
  'Sobeys',
  'Foodland',
  'FreshCo',
  'Safeway',
  'IGA',
  'Metro',
  'Food Basics',
  'Super C',
  'Farm Boy',
  "Longo's",
  'Save-On-Foods',
  'T&T Supermarket',
  'Whole Foods',
  'Walmart',
  'Costco',
  'Giant Tiger',
  'Bulk Barn',
  'M&M Food Market',
  "Sam's Club",
  'Kroger',
  'Aldi',
  "Trader Joe's",
  'Target',
];

/** Lower-case, apostrophes dropped, other punctuation turned into spaces. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const NORMALIZED_CHAINS = CHAIN_NAMES.map(normalizeName);

/** True when a known chain's name appears as whole words in the store name. */
export function isKnownChainName(name: string): boolean {
  const padded = ` ${normalizeName(name)} `;
  return NORMALIZED_CHAINS.some(chain => padded.includes(` ${chain} `));
}

/** Same name this many times in one search → treat it as a chain. */
export const REPEATED_NAME_LIMIT = 3;

export function isChain(lead: VendorLead, allLeads: VendorLead[]): boolean {
  if (isKnownChainName(lead.name)) {
    return true;
  }
  const key = normalizeName(lead.name);
  const sameName = allLeads.filter(l => normalizeName(l.name) === key).length;
  return sameName >= REPEATED_NAME_LIMIT;
}

const BULK_TYPES = ['warehouse_store', 'wholesaler'];
const BULK_WORDS = ['wholesale', 'bulk', 'warehouse', 'cash and carry'];

/** Warehouse or wholesale stores, which suit big orders even when independent. */
export function isBulkStore(lead: VendorLead): boolean {
  const name = ` ${normalizeName(lead.name)} `;
  return (
    lead.placeTypes.some(t => BULK_TYPES.includes(t)) ||
    BULK_WORDS.some(w => name.includes(` ${w} `))
  );
}
