/**
 * Sample vendor-search results used when the server isn't running or has no
 * API keys. Every store, address, phone and email here is fictional.
 */
import { MarketType, VendorLead } from '../types';

/**
 * Covers all three strengths: independent grocers and a farm stand (local),
 * a warehouse store and a three-branch chain (bulk), and a far-away shop that
 * should never win "closest".
 */
export const DEMO_LEADS: VendorLead[] = [
  {
    placeId: 'demo-hillside',
    name: 'Hillside Dairy & Market',
    address: '412 Orchard Rd (sample address)',
    phone: '555-0131',
    email: 'ellen@hillsidedairy.example',
    distanceKm: 3.2,
    placeTypes: ['grocery_store', 'food_store'],
    rating: 4.8,
    reviewCount: 212,
    openNow: true,
  },
  {
    placeId: 'demo-nonnas',
    name: "Nonna's Corner Grocery",
    address: '18 King St (sample address)',
    phone: '555-0164',
    email: 'shop@nonnascorner.example',
    distanceKm: 1.4,
    placeTypes: ['grocery_store'],
    rating: 4.6,
    reviewCount: 88,
    openNow: true,
  },
  {
    placeId: 'demo-greenacres',
    name: 'Green Acres Farm Stand',
    address: 'Concession Rd 5 (sample address)',
    phone: '555-0109',
    email: 'hello@greenacresfarm.example',
    distanceKm: 9.8,
    placeTypes: ['farm', 'food_store'],
    rating: 4.9,
    reviewCount: 54,
  },
  {
    placeId: 'demo-valley',
    name: 'Valley Wholesale Foods',
    address: '90 Industrial Ave (sample address)',
    phone: '555-0177',
    website: 'https://valleywholesale.example',
    distanceKm: 6.5,
    placeTypes: ['wholesaler', 'food_store'],
    rating: 4.3,
    reviewCount: 310,
  },
  {
    placeId: 'demo-bigbasket-1',
    name: 'Big Basket Superstore',
    address: '1200 Main St (sample address)',
    phone: '555-0190',
    website: 'https://bigbasket.example',
    distanceKm: 2.1,
    placeTypes: ['supermarket', 'grocery_store'],
    rating: 4.1,
    reviewCount: 1500,
    openNow: true,
  },
  {
    placeId: 'demo-bigbasket-2',
    name: 'Big Basket Superstore',
    address: '55 Westmount Rd (sample address)',
    phone: '555-0191',
    website: 'https://bigbasket.example',
    distanceKm: 3.8,
    placeTypes: ['supermarket', 'grocery_store'],
    rating: 3.9,
    reviewCount: 980,
  },
  {
    placeId: 'demo-bigbasket-3',
    name: 'Big Basket Superstore',
    address: '700 Fairway Rd (sample address)',
    phone: '555-0192',
    website: 'https://bigbasket.example',
    distanceKm: 6.0,
    placeTypes: ['supermarket', 'grocery_store'],
    rating: 4.0,
    reviewCount: 1200,
  },
  {
    placeId: 'demo-lakeside',
    name: 'Lakeside Organics',
    address: '3 Shore Line (sample address)',
    phone: '555-0150',
    email: 'info@lakesideorganics.example',
    distanceKm: 24.0,
    placeTypes: ['grocery_store', 'health_food_store'],
    rating: 4.7,
    reviewCount: 40,
  },
];

const RESEARCH: { match: RegExp; types: MarketType[] }[] = [
  {
    match: /yog/i,
    types: [
      {
        name: 'Greek yogurt',
        goodFor:
          'People often say it holds parfait layers best, because it is thick and does not weep into the granola.',
        sources: [],
      },
      {
        name: 'Plain whole-milk yogurt',
        goodFor:
          'Usually the cheapest per kg. Softer, so people often say granola goes soggy sooner.',
        sources: [],
      },
      {
        name: 'Skyr or high-protein yogurt',
        goodFor:
          'Very thick and tangy. Often pricier; some bakers mix it with plain yogurt.',
        sources: [],
      },
    ],
  },
  {
    match: /oat/i,
    types: [
      {
        name: 'Barista oat milk',
        goodFor:
          'People often say it foams and holds up to heat best, so it suits custards and warm drinks.',
        sources: [],
      },
      {
        name: 'Regular oat milk',
        goodFor: 'Cheaper and thinner. Fine for soaking oats or cold parfaits.',
        sources: [],
      },
      {
        name: 'Unsweetened shelf-stable cartons',
        goodFor:
          'Keeps for months unopened, which helps if you only use a little at a time.',
        sources: [],
      },
    ],
  },
  {
    match: /vanil/i,
    types: [
      {
        name: 'Pure vanilla extract',
        goodFor:
          'People often say the flavour comes through best in no-bake things like parfait cream.',
        sources: [],
      },
      {
        name: 'Imitation vanilla',
        goodFor:
          'Much cheaper. Many bakers say it is hard to tell apart once baked.',
        sources: [],
      },
      {
        name: 'Vanilla bean paste',
        goodFor: 'Shows the little black specks, which people like in cream layers.',
        sources: [],
      },
    ],
  },
];

const GENERIC_TYPES: MarketType[] = [
  {
    name: 'Store brand or bulk',
    goodFor: 'Usually the lowest price per kg. Worth a small test batch first.',
    sources: [],
  },
  {
    name: 'Name brand',
    goodFor: 'More consistent from batch to batch, at a higher price.',
    sources: [],
  },
  {
    name: 'Local or organic',
    goodFor: 'Often fresher, and a nice story for customers. Usually costs more.',
    sources: [],
  },
];

export function demoMarketTypes(query: string): MarketType[] {
  return RESEARCH.find(r => r.match.test(query))?.types ?? GENERIC_TYPES;
}

/** A realistic reply to paste in during the demo. */
export const DEMO_REPLY = `Hi Rose,

Thanks for reaching out! Our plain yogurt is $19 for a 5 kg pail. Minimum order is 10 kg, and we deliver Thursdays for $8. Prices usually go up about 10% in winter when the milk supply drops.

Ellen
Hillside Dairy & Market`;
