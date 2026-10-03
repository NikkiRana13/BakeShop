/**
 * Vendor search logic: how much Grandma really uses, where the money goes,
 * what a quote would do to the cost of each treat, which nearby stores to
 * suggest, and the wording of price-inquiry emails. All pure and offline.
 */
import {
  AppState,
  BaseUnit,
  PackageUnit,
  Supplier,
  VendorContact,
  VendorLead,
  VendorPick,
  VendorStrength,
} from '../types';
import {
  addDays,
  daysBetween,
  formatCents,
  formatQty,
  roundQty,
  startOfDay,
  todayKey,
  toBaseQuantity,
} from '../utils/format';
import { isBulkStore, isChain } from './chains';
import { Advice } from './insights';
import { estimateBatchCost, findIngredient } from './selectors';

export const WEEKS_PER_MONTH = 30 / 7;
/** An ingredient at or above this share of spending is worth shopping around for. */
export const COST_DRIVER_SHARE = 0.25;
export const FOLLOW_UP_AFTER_DAYS = 7;

function inLastWeek(iso: string, today: string): boolean {
  const t = Date.parse(iso);
  return (
    t >= startOfDay(addDays(today, -6)).getTime() &&
    t < startOfDay(addDays(today, 1)).getTime()
  );
}

/** Base units of an ingredient that went into batches over the last 7 days. */
export function weeklyUsage(
  state: AppState,
  ingredientId: string,
  today: string = todayKey(),
): number {
  let total = 0;
  for (const b of state.batches) {
    if (!inLastWeek(b.dateTime, today)) {
      continue;
    }
    const treat = state.treats.find(t => t.id === b.treatId);
    for (const line of treat?.recipe ?? []) {
      if (line.ingredientId === ingredientId) {
        total += line.quantity * b.servings;
      }
    }
  }
  return total;
}

/** Servings of a treat made over the last 7 days. */
export function weeklyServings(
  state: AppState,
  treatId: string,
  today: string = todayKey(),
): number {
  return state.batches
    .filter(b => b.treatId === treatId && inLastWeek(b.dateTime, today))
    .reduce((n, b) => n + b.servings, 0);
}

/** "$43" — whole dollars, for amounts Grandma decides on at a glance. */
export function formatWholeDollars(cents: number): string {
  return `$${Math.round(Math.abs(cents) / 100).toLocaleString('en-US')}`;
}

// ------------------------------------------------------------ Cost drivers

export interface IngredientSpend {
  ingredientId: string;
  name: string;
  monthlyCents: number;
  share: number;
}

/** Estimated monthly spend per ingredient at last week's pace, largest first. */
export function ingredientSpend(
  state: AppState,
  today: string = todayKey(),
): IngredientSpend[] {
  const rows = state.ingredients.map(ing => ({
    ingredientId: ing.id,
    name: ing.name,
    monthlyCents:
      weeklyUsage(state, ing.id, today) * ing.costPerUnitCents * WEEKS_PER_MONTH,
  }));
  const total = rows.reduce((s, r) => s + r.monthlyCents, 0);
  return rows
    .map(r => ({ ...r, share: total > 0 ? r.monthlyCents / total : 0 }))
    .sort((a, b) => b.monthlyCents - a.monthlyCents);
}

/** Suggests looking for other options where most of the money goes (#1). */
export function costAdvice(
  state: AppState,
  today: string = todayKey(),
): Advice[] {
  return ingredientSpend(state, today)
    .filter(r => r.share >= COST_DRIVER_SHARE)
    .map(r => ({
      id: `cost-${r.ingredientId}`,
      kind: 'cost' as const,
      ingredientId: r.ingredientId,
      title: `${r.name} is ${Math.round(r.share * 100)}% of your ingredient spend`,
      body: `About ${formatWholeDollars(r.monthlyCents)} a month goes on ${r.name.toLowerCase()} at your current pace. A better price here saves more than anywhere else. Want to see other options?`,
    }));
}

// ------------------------------------------------------------ Quote impact

export interface QuoteInput {
  ingredientId: string;
  priceCents: number;
  packageSize: number;
  packageUnit: PackageUnit;
  /** Charged once per order. */
  deliveryFeeCents: number;
  /** Smallest order the vendor accepts, in the ingredient's base unit. */
  minOrderQty?: number;
}

export interface TreatImpact {
  treatId: string;
  treatName: string;
  beforeCents: number;
  afterCents: number;
}

export interface QuoteImpact {
  /** Cost per base unit including delivery and anything that would spoil. */
  effectiveRateCents: number;
  currentRateCents: number;
  weeklyUse: number;
  unit: BaseUnit;
  packagesPerOrder: number;
  spoiledPerOrder: number;
  /** Positive means the quote saves money. */
  monthlySavingsCents: number;
  treats: TreatImpact[];
  notes: string[];
}

/**
 * What a quote would do to the cost of each treat (#2). An order covers one
 * week (or the vendor's minimum, if larger); anything that would expire
 * before it is used counts as part of the cost.
 */
export function quoteImpact(
  state: AppState,
  quote: QuoteInput,
  today: string = todayKey(),
): QuoteImpact | null {
  const ing = findIngredient(state, quote.ingredientId);
  const packageBase = toBaseQuantity(quote.packageSize, quote.packageUnit, ing.unit);
  const weeklyUse = weeklyUsage(state, ing.id, today);
  if (!packageBase || packageBase <= 0 || weeklyUse <= 0 || quote.priceCents <= 0) {
    return null;
  }
  const orderQty = Math.max(weeklyUse, quote.minOrderQty ?? 0);
  const packages = Math.ceil(orderQty / packageBase - 1e-9);
  const bought = packages * packageBase;
  const usable = Math.min(bought, (weeklyUse / 7) * ing.shelfLifeDays);
  const spoiled = bought - usable;
  const effectiveRateCents =
    (packages * quote.priceCents + quote.deliveryFeeCents) / usable;
  const diff = effectiveRateCents - ing.costPerUnitCents;

  const treats: TreatImpact[] = state.treats
    .filter(t => t.recipe.some(l => l.ingredientId === ing.id))
    .sort(
      (a, b) =>
        weeklyServings(state, b.id, today) - weeklyServings(state, a.id, today),
    )
    .map(t => {
      const line = t.recipe.find(l => l.ingredientId === ing.id)!;
      const beforeCents = estimateBatchCost(state, t.id, 1).totalCents;
      return {
        treatId: t.id,
        treatName: t.name,
        beforeCents,
        afterCents: Math.round(beforeCents + line.quantity * diff),
      };
    });

  const notes: string[] = [];
  if (quote.deliveryFeeCents > 0) {
    notes.push(`Includes the ${formatCents(quote.deliveryFeeCents)} delivery fee.`);
  }
  if (quote.minOrderQty && quote.minOrderQty > weeklyUse) {
    notes.push(
      `Minimum order is ${formatQty(quote.minOrderQty, ing.unit)}, more than the ${formatQty(
        weeklyUse,
        ing.unit,
      )} you use in a week.`,
    );
  }
  if (spoiled > bought * 0.01) {
    notes.push(
      `About ${formatQty(friendlyRound(spoiled), ing.unit)} would expire before you use it, and that is counted in the cost.`,
    );
  }
  return {
    effectiveRateCents,
    currentRateCents: ing.costPerUnitCents,
    weeklyUse,
    unit: ing.unit,
    packagesPerOrder: packages,
    spoiledPerOrder: spoiled,
    monthlySavingsCents: Math.round(-diff * weeklyUse * WEEKS_PER_MONTH),
    treats,
    notes,
  };
}

/** "saves about $43/month", "costs about $12 more/month", "about the same cost". */
export function savingsPhrase(monthlySavingsCents: number): string {
  if (Math.abs(monthlySavingsCents) < 100) {
    return 'about the same cost';
  }
  return monthlySavingsCents > 0
    ? `saves about ${formatWholeDollars(monthlySavingsCents)}/month`
    : `costs about ${formatWholeDollars(monthlySavingsCents)} more/month`;
}

// ------------------------------------------------------------ Vendor picks

const STRENGTH_COPY: Record<VendorStrength, { headline: string; pitch: string }> = {
  local: {
    headline: 'Local & natural',
    pitch: 'Independent shops are often fresher, and you can talk to the owner.',
  },
  bulk: {
    headline: 'Best for bulk',
    pitch: 'Chains and warehouse stores usually have the lowest price for big orders.',
  },
  closest: {
    headline: 'Closest',
    pitch: 'Closest to the bakery: quick pickup, no delivery needed.',
  },
};

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;
}

/** Higher is better: well rated by many people, and not too far. */
export function leadScore(lead: VendorLead): number {
  const rating = lead.rating ?? 3.5;
  return rating * Math.log10((lead.reviewCount ?? 0) + 10) - 0.15 * lead.distanceKm;
}

function factReasons(lead: VendorLead, chain: boolean): string[] {
  const reasons = [formatDistance(lead.distanceKm)];
  reasons.push(chain ? 'Chain store' : 'Independent, locally run');
  if (lead.rating !== undefined && lead.reviewCount) {
    reasons.push(
      `Rated ${lead.rating.toFixed(1)} by ${lead.reviewCount.toLocaleString('en-US')} people`,
    );
  }
  if (lead.openNow) {
    reasons.push('Open now');
  }
  return reasons;
}

/**
 * Up to three suggestions, each good at something different: the best local
 * store, the best store for bulk orders, and the closest of the rest. A
 * strength with no candidate is left out rather than filled with a weak pick.
 */
export function pickStrongChoices(leads: VendorLead[]): VendorPick[] {
  const unique = leads.filter(
    (l, i) => leads.findIndex(x => x.placeId === l.placeId) === i,
  );
  const info = unique.map(lead => {
    const chain = isChain(lead, unique);
    const bulk = chain || isBulkStore(lead);
    return { lead, chain, bulk };
  });
  const byScore = (a: { lead: VendorLead }, b: { lead: VendorLead }) =>
    leadScore(b.lead) - leadScore(a.lead);
  const taken = new Set<string>();
  const make = (
    x: (typeof info)[number],
    strength: VendorStrength,
  ): VendorPick => {
    taken.add(x.lead.placeId);
    return {
      lead: x.lead,
      strength,
      isChain: x.chain,
      headline: STRENGTH_COPY[strength].headline,
      reasons: [STRENGTH_COPY[strength].pitch, ...factReasons(x.lead, x.chain)],
      contact: x.chain ? 'price_check' : 'email',
    };
  };

  const picks: VendorPick[] = [];
  const local = info.filter(x => !x.bulk).sort(byScore)[0];
  if (local) {
    picks.push(make(local, 'local'));
  }
  const bulk = info.filter(x => x.bulk).sort(byScore)[0];
  if (bulk) {
    picks.push(make(bulk, 'bulk'));
  }
  const closest = info
    .filter(x => !taken.has(x.lead.placeId))
    .sort((a, b) => a.lead.distanceKm - b.lead.distanceKm)[0];
  if (closest) {
    picks.push(make(closest, 'closest'));
  }
  return picks;
}

// ------------------------------------------------------------------ Emails

/** Rounds to numbers a person would say: 21 kg, 2.5 kg, 750 g. */
export function friendlyRound(qty: number): number {
  if (qty >= 10000) {
    return Math.round(qty / 1000) * 1000;
  }
  if (qty >= 1000) {
    return Math.round(qty / 500) * 500;
  }
  if (qty >= 100) {
    return Math.round(qty / 50) * 50;
  }
  return Math.max(1, Math.round(qty));
}

/** "21 kg", "4.5 L", "750 g". */
export function friendlyQuantity(qty: number, unit: BaseUnit): string {
  const q = friendlyRound(qty);
  if (unit === 'g' && q >= 1000) {
    return `${roundQty(q / 1000)} kg`;
  }
  if (unit === 'mL' && q >= 1000) {
    return `${roundQty(q / 1000)} L`;
  }
  return formatQty(q, unit);
}

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
}

function signature(state: AppState): string {
  const p = state.profile;
  return `${p.ownerName}\n${p.bakeryName}\n${p.phone} · ${p.email}`;
}

/**
 * A short, specific price inquiry (#3, #6). Real weekly volume makes it look
 * like steady business; the signature says clearly who is writing (CASL).
 */
export function draftQuoteEmail(
  state: AppState,
  input: {
    vendorName: string;
    vendorEmail?: string;
    ingredientLabel: string;
    /** Weekly amount in the ingredient's base unit, when known. */
    weeklyQty?: { qty: number; unit: BaseUnit };
  },
): EmailDraft {
  const p = state.profile;
  const label = input.ingredientLabel.trim().toLowerCase();
  const usage =
    input.weeklyQty && input.weeklyQty.qty > 0
      ? `I use about ${friendlyQuantity(input.weeklyQty.qty, input.weeklyQty.unit)} of ${label} a week, steady through the school year.`
      : `I'm looking for a steady weekly supply of ${label}.`;
  const body = [
    `Hi ${input.vendorName} team,`,
    '',
    `My name is ${p.ownerName} and I run ${p.bakeryName}, a small bakery in ${p.city}. ${usage}`,
    '',
    'Could you quote me a weekly price for that amount, including delivery if you offer it? And does the price change by season?',
    '',
    'Thank you very much,',
    signature(state),
  ].join('\n');
  return {
    to: input.vendorEmail ?? '',
    subject: `Price inquiry: ${label} for a small bakery`,
    body,
  };
}

/** The one gentle follow-up, sent only if there's been no reply for a week. */
export function draftFollowUp(
  state: AppState,
  input: { vendorName: string; vendorEmail?: string; ingredientLabel: string },
): EmailDraft {
  const label = input.ingredientLabel.trim().toLowerCase();
  return {
    to: input.vendorEmail ?? '',
    subject: `Following up: ${label} for a small bakery`,
    body: [
      `Hi ${input.vendorName} team,`,
      '',
      `I wrote last week asking about a weekly price for ${label}. If you have a moment, I'd love to hear back. And if email isn't easy, a quick call is just as good.`,
      '',
      'Thank you,',
      signature(state),
    ].join('\n'),
  };
}

export function mailtoUrl(draft: EmailDraft): string {
  return `mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(
    draft.subject,
  )}&body=${encodeURIComponent(draft.body)}`;
}

// --------------------------------------------------------------- Follow-up

export type ContactStage =
  | 'waiting'
  | 'follow_up_due'
  | 'waiting_after_follow_up'
  | 'replied'
  | 'no_reply';

/**
 * Where an email stands. One follow-up after a week of silence, then the
 * app stops asking: a week after the follow-up it is simply "no reply".
 */
export function contactStage(
  contact: VendorContact,
  today: string = todayKey(),
): ContactStage {
  if (contact.status === 'replied') {
    return 'replied';
  }
  if (contact.status === 'no_reply') {
    return 'no_reply';
  }
  if (contact.followUpOn) {
    return daysBetween(contact.followUpOn, today) >= FOLLOW_UP_AFTER_DAYS
      ? 'no_reply'
      : 'waiting_after_follow_up';
  }
  return daysBetween(contact.sentOn, today) >= FOLLOW_UP_AFTER_DAYS
    ? 'follow_up_due'
    : 'waiting';
}

export function followUpsDue(
  state: AppState,
  today: string = todayKey(),
): { contact: VendorContact; supplier: Supplier | undefined }[] {
  return state.contacts
    .filter(c => contactStage(c, today) === 'follow_up_due')
    .map(contact => ({
      contact,
      supplier: state.suppliers.find(s => s.id === contact.supplierId),
    }));
}
