import {
  createSeedState,
  DEMO_PROFILE,
  withNewFieldDefaults,
} from '../src/data/seed';
import { DEMO_LEADS, DEMO_REPLY } from '../src/data/demoVendors';
import { isChain, isKnownChainName } from '../src/logic/chains';
import { parseQuoteLocally } from '../src/logic/quoteParser';
import { estimateBatchCost } from '../src/logic/selectors';
import { planShopping } from '../src/logic/shopping';
import {
  recordEmailSent,
  recordFollowUp,
  saveQuote,
  saveResearch,
  saveVendorFromLead,
  supplierIdForLead,
} from '../src/logic/vendorActions';
import {
  contactStage,
  costAdvice,
  draftQuoteEmail,
  followUpsDue,
  pickStrongChoices,
  quoteImpact,
  savingsPhrase,
  weeklyUsage,
} from '../src/logic/vendors';
import { AppState, Result, VendorLead } from '../src/types';
import { addDays, todayKey } from '../src/utils/format';

const NOW = new Date(2026, 9, 2, 14, 30);
const TODAY = todayKey(NOW);

function unwrap(r: Result): AppState {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.state;
}

const lead = (over: Partial<VendorLead>): VendorLead => ({
  placeId: over.placeId ?? over.name ?? 'x',
  name: 'Some Store',
  address: '1 Test St',
  distanceKm: 1,
  placeTypes: ['grocery_store'],
  ...over,
});

describe('saved data upgrade', () => {
  it('keeps recorded data and fills in the new fields', () => {
    const s = createSeedState(NOW);
    // A state saved before vendor search existed has none of these fields.
    const old: Partial<AppState> = { ...s };
    delete old.profile;
    delete old.contacts;
    delete old.research;
    const upgraded = withNewFieldDefaults(old as AppState);
    expect(upgraded.sales).toEqual(s.sales);
    expect(upgraded.batches).toEqual(s.batches);
    expect(upgraded.profile).toEqual(DEMO_PROFILE);
    expect(upgraded.contacts).toEqual([]);
    expect(upgraded.research).toEqual([]);
  });
});

describe('usage and cost drivers', () => {
  const s = createSeedState(NOW);

  it('counts yogurt used in last week’s batches (210 servings × 100 g)', () => {
    expect(weeklyUsage(s, 'yogurt', TODAY)).toBe(21000);
  });

  it('flags yogurt as the biggest share of ingredient spend', () => {
    const advice = costAdvice(s, TODAY);
    expect(advice).toHaveLength(1);
    expect(advice[0].ingredientId).toBe('yogurt');
    expect(advice[0].title).toBe('Yogurt is 33% of your ingredient spend');
    expect(advice[0].body).toContain('$414 a month');
  });
});

describe('quote impact', () => {
  const s = createSeedState(NOW);
  const quote = {
    ingredientId: 'yogurt',
    priceCents: 1900,
    packageSize: 5,
    packageUnit: 'kg' as const,
    deliveryFeeCents: 800,
    minOrderQty: 10000,
  };

  it('turns a cheaper quote into per-treat costs and monthly savings', () => {
    const impact = quoteImpact(s, quote, TODAY)!;
    // 5 pails (25 kg) + $8 delivery = $103 for 25 kg → $4.12/kg vs $4.60/kg.
    expect(impact.packagesPerOrder).toBe(5);
    expect(impact.effectiveRateCents).toBeCloseTo(0.412, 6);
    expect(impact.monthlySavingsCents).toBe(4320);
    expect(savingsPhrase(impact.monthlySavingsCents)).toBe(
      'saves about $43/month',
    );
    const apple = impact.treats.find(t => t.treatId === 'apple')!;
    expect(apple.beforeCents).toBe(estimateBatchCost(s, 'apple', 1).totalCents);
    expect(apple.beforeCents).toBe(169);
    expect(apple.afterCents).toBe(164);
    // Most-made treat first.
    expect(impact.treats[0].treatId).toBe('apple');
    expect(impact.notes).toContain('Includes the $8.00 delivery fee.');
  });

  it('counts stock that would expire before use as part of the cost', () => {
    // A 100 kg minimum: only 42 kg (14 days × 3 kg) can be used in time.
    const impact = quoteImpact(s, { ...quote, minOrderQty: 100000 }, TODAY)!;
    expect(impact.spoiledPerOrder).toBeCloseTo(58000, 0);
    expect(impact.monthlySavingsCents).toBeLessThan(0);
    expect(savingsPhrase(impact.monthlySavingsCents)).toMatch(/^costs about \$\d+ more\/month$/);
    expect(impact.notes.some(n => n.includes('would expire'))).toBe(true);
  });

  it('returns null for a unit that does not match the ingredient', () => {
    expect(quoteImpact(s, { ...quote, packageUnit: 'L' }, TODAY)).toBeNull();
  });
});

describe('vendor picks', () => {
  it('spots chains by name and by repeated branches, not one-off shops', () => {
    expect(isKnownChainName('No Frills - Erb St')).toBe(true);
    expect(isKnownChainName("Longo's")).toBe(true);
    expect(isKnownChainName("Nonna's Corner Grocery")).toBe(false);
    const big = DEMO_LEADS.find(l => l.name === 'Big Basket Superstore')!;
    expect(isChain(big, DEMO_LEADS)).toBe(true);
    const nonna = DEMO_LEADS.find(l => l.placeId === 'demo-nonnas')!;
    expect(isChain(nonna, DEMO_LEADS)).toBe(false);
  });

  it('picks one local, one bulk and the closest of the rest', () => {
    const picks = pickStrongChoices(DEMO_LEADS);
    expect(picks.map(p => [p.strength, p.lead.placeId])).toEqual([
      ['local', 'demo-hillside'],
      ['bulk', 'demo-bigbasket-1'],
      ['closest', 'demo-nonnas'],
    ]);
    expect(new Set(picks.map(p => p.lead.placeId)).size).toBe(3);
    const bulk = picks.find(p => p.strength === 'bulk')!;
    expect(bulk.isChain).toBe(true);
    expect(bulk.contact).toBe('price_check');
    expect(picks.find(p => p.strength === 'local')!.contact).toBe('email');
    // The far-away shop never wins "closest".
    expect(picks.some(p => p.lead.placeId === 'demo-lakeside')).toBe(false);
  });

  it('builds reasons only from the store’s real details', () => {
    const local = pickStrongChoices(DEMO_LEADS)[0];
    expect(local.reasons).toEqual([
      'Independent shops are often fresher, and you can talk to the owner.',
      '3.2 km away',
      'Independent, locally run',
      'Rated 4.8 by 212 people',
      'Open now',
    ]);
    const bare = pickStrongChoices([lead({ name: 'Tiny Shop', distanceKm: 0.4 })]);
    expect(bare[0].reasons).toEqual([
      'Independent shops are often fresher, and you can talk to the owner.',
      '400 m away',
      'Independent, locally run',
    ]);
  });

  it('skips a strength with nothing to offer instead of filling it', () => {
    const picks = pickStrongChoices([
      lead({ placeId: 'a', name: 'Corner Shop', distanceKm: 2 }),
      lead({ placeId: 'b', name: 'Farm Gate Eggs', distanceKm: 1 }),
    ]);
    expect(picks.map(p => p.strength)).toEqual(['local', 'closest']);
  });

  it('gives a chain the price check even when it wins "closest"', () => {
    const picks = pickStrongChoices([
      lead({ placeId: 'a', name: 'Corner Shop', distanceKm: 5 }),
      lead({ placeId: 'b', name: 'Walmart Supercentre', distanceKm: 3, rating: 4, reviewCount: 2000 }),
      lead({ placeId: 'c', name: 'Costco Wholesale', distanceKm: 1, rating: 3, reviewCount: 10 }),
    ]);
    const closest = picks.find(p => p.strength === 'closest')!;
    expect(closest.lead.placeId).toBe('c');
    expect(closest.contact).toBe('price_check');
  });
});

describe('emails', () => {
  const s = createSeedState(NOW);

  it('uses real weekly volume, asks about seasons and says who is writing', () => {
    const draft = draftQuoteEmail(s, {
      vendorName: 'Hillside Dairy & Market',
      vendorEmail: 'ellen@hillsidedairy.example',
      ingredientLabel: 'Plain yogurt',
      weeklyQty: { qty: weeklyUsage(s, 'yogurt', TODAY), unit: 'g' },
    });
    expect(draft.to).toBe('ellen@hillsidedairy.example');
    expect(draft.subject).toBe('Price inquiry: plain yogurt for a small bakery');
    expect(draft.body).toContain('I use about 21 kg of plain yogurt a week');
    expect(draft.body).toContain('does the price change by season?');
    expect(draft.body).toContain('Grandma Rose');
    expect(draft.body).toContain('555-0100 · grandma@ordersdesk.example');
  });

  it('asks generally when the weekly amount is unknown', () => {
    const draft = draftQuoteEmail(s, { vendorName: 'X', ingredientLabel: 'Oat milk' });
    expect(draft.body).toContain('a steady weekly supply of oat milk');
  });
});

describe('vendor actions', () => {
  const hillside = DEMO_LEADS.find(l => l.placeId === 'demo-hillside')!;
  const base = () =>
    unwrap(saveVendorFromLead(createSeedState(NOW), hillside, false));
  const supplierId = supplierIdForLead(hillside);

  it('saves a lead as a local supplier, once', () => {
    let s = base();
    s = unwrap(saveVendorFromLead(s, hillside, false));
    const saved = s.suppliers.filter(x => x.placeId === hillside.placeId);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ isLocal: true, email: hillside.email });
  });

  it('allows one follow-up a week after the email, then stops', () => {
    let s = unwrap(
      recordEmailSent(base(), {
        supplierId,
        ingredientId: 'yogurt',
        ingredientLabel: 'Plain yogurt',
        now: NOW,
      }),
    );
    // Opening the same draft again doesn't add a second email.
    s = unwrap(
      recordEmailSent(s, { supplierId, ingredientId: 'yogurt', ingredientLabel: 'plain yogurt', now: NOW }),
    );
    expect(s.contacts).toHaveLength(1);
    const c = s.contacts[0];
    expect(followUpsDue(s, addDays(TODAY, 6))).toHaveLength(0);
    expect(followUpsDue(s, addDays(TODAY, 7))).toHaveLength(1);

    const later = new Date(2026, 9, 9, 10);
    s = unwrap(recordFollowUp(s, c.id, later));
    expect(followUpsDue(s, addDays(TODAY, 8))).toHaveLength(0);
    expect(recordFollowUp(s, c.id, later).ok).toBe(false);
    expect(contactStage(s.contacts[0], addDays(TODAY, 13))).toBe('waiting_after_follow_up');
    expect(contactStage(s.contacts[0], addDays(TODAY, 14))).toBe('no_reply');
  });

  it('saves a quote as a dated offer the shopping helper can use', () => {
    let s = unwrap(
      recordEmailSent(base(), { supplierId, ingredientId: 'yogurt', ingredientLabel: 'Plain yogurt', now: NOW }),
    );
    const parsed = parseQuoteLocally(DEMO_REPLY);
    s = unwrap(
      saveQuote(s, {
        supplierId,
        ingredientId: 'yogurt',
        productName: 'Plain yogurt, 5 kg pail',
        packageSize: parsed.packageSize!,
        packageUnit: parsed.packageUnit!,
        priceCents: parsed.priceCents!,
        deliveryFeeCents: parsed.deliveryFeeCents,
        minOrderQty: parsed.minOrderQty,
        deliveryNote: parsed.deliveryNote,
        seasonalNote: parsed.seasonalNote,
        now: NOW,
      }),
    );
    const offer = s.offers.find(o => o.source === 'quote')!;
    expect(offer).toMatchObject({ quotedOn: TODAY, priceCents: 1900, supplierId });
    expect(offer.seasonalNote).toContain('winter');
    expect(s.contacts[0].status).toBe('replied');
    expect(s.suppliers.find(x => x.id === supplierId)!.deliveryFeeCents).toBe(800);

    // The shopping helper shows the best two offers; with the listed
    // yogurt offers removed, the quote is the one it recommends.
    const onlyQuote = {
      ...s,
      offers: s.offers.filter(o => o.ingredientId !== 'yogurt' || o.source === 'quote'),
    };
    const plan = planShopping(onlyQuote, 'apple', 100, addDays(TODAY, 3), TODAY);
    const yogurt = plan.lines.find(l => l.ingredient.id === 'yogurt')!;
    expect(yogurt.best?.offer.id).toBe(offer.id);
    expect(yogurt.best?.reasons).toContain('Local option');
  });

  it('rejects a quote in the wrong kind of unit', () => {
    const r = saveQuote(base(), {
      supplierId,
      ingredientId: 'yogurt',
      productName: 'Yogurt',
      packageSize: 1,
      packageUnit: 'L',
      priceCents: 500,
    });
    expect(r.ok).toBe(false);
  });

  it('keeps only the five newest searches', () => {
    let s = createSeedState(NOW);
    for (let i = 0; i < 7; i++) {
      s = unwrap(
        saveResearch(s, {
          id: `r${i}`,
          query: `q${i}`,
          ingredientId: null,
          ranAt: NOW.toISOString(),
          live: false,
          types: [],
          vendors: [],
        }),
      );
    }
    expect(s.research.map(r => r.id)).toEqual(['r6', 'r5', 'r4', 'r3', 'r2']);
  });
});

describe('reading a reply offline', () => {
  it('pulls price, delivery, minimum and season from a clear reply', () => {
    expect(parseQuoteLocally(DEMO_REPLY)).toMatchObject({
      found: true,
      priceCents: 1900,
      packageSize: 5,
      packageUnit: 'kg',
      deliveryFeeCents: 800,
      deliveryNote: 'Delivers thursdays',
      minOrderQty: 10000,
    });
  });

  it('reads per-kg prices', () => {
    expect(parseQuoteLocally('It is $3.80/kg, free delivery on Fridays.')).toMatchObject({
      found: true,
      priceCents: 380,
      packageSize: 1,
      packageUnit: 'kg',
      deliveryFeeCents: 0,
    });
  });

  it('does not guess when there is no clear price', () => {
    const r = parseQuoteLocally('Depends on the season, give me a call!');
    expect(r.found).toBe(false);
    expect(r.priceCents).toBeUndefined();
  });
});
