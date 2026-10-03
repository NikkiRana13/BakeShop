/**
 * Pure state transitions for vendor search. Like actions.ts, each returns a
 * new state or a plain-language error.
 */
import {
  AppState,
  PackageUnit,
  ResearchRun,
  Result,
  Supplier,
  VendorLead,
} from '../types';
import { makeId, todayKey, toBaseQuantity } from '../utils/format';
import { findIngredient } from './selectors';

const ok = (state: AppState): Result => ({ ok: true, state });
const fail = (error: string): Result => ({ ok: false, error });

export const MAX_RESEARCH_RUNS = 5;

/** Keeps the newest searches so re-opening a result doesn't search again. */
export function saveResearch(state: AppState, run: ResearchRun): Result {
  return ok({
    ...state,
    research: [run, ...state.research.filter(r => r.id !== run.id)].slice(
      0,
      MAX_RESEARCH_RUNS,
    ),
  });
}

export function supplierIdForLead(lead: VendorLead): string {
  return `place-${lead.placeId}`;
}

/** Turns a search result into a saved supplier, updating it if already saved. */
export function saveVendorFromLead(
  state: AppState,
  lead: VendorLead,
  isChain: boolean,
): Result {
  const existing = state.suppliers.find(s => s.placeId === lead.placeId);
  const fields: Supplier = {
    id: existing?.id ?? supplierIdForLead(lead),
    name: lead.name,
    isLocal: !isChain,
    isChain,
    deliveryFeeCents: existing?.deliveryFeeCents ?? 0,
    placeId: lead.placeId,
    address: lead.address,
    distanceKm: lead.distanceKm,
    phone: lead.phone ?? existing?.phone,
    website: lead.website ?? existing?.website,
    email: lead.email ?? existing?.email,
  };
  return ok({
    ...state,
    suppliers: existing
      ? state.suppliers.map(s => (s.id === existing.id ? fields : s))
      : [...state.suppliers, fields],
  });
}

export function updateSupplierEmail(
  state: AppState,
  supplierId: string,
  email: string,
): Result {
  const trimmed = email.trim();
  if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return fail('That email address does not look right. Check it and try again.');
  }
  return ok({
    ...state,
    suppliers: state.suppliers.map(s =>
      s.id === supplierId ? { ...s, email: trimmed || undefined } : s,
    ),
  });
}

/**
 * Records that Grandma opened an email to a vendor. Opening the same draft
 * again (say, she closed the mail app without sending) doesn't add a second
 * record.
 */
export function recordEmailSent(
  state: AppState,
  input: {
    supplierId: string;
    ingredientId: string | null;
    ingredientLabel: string;
    now?: Date;
  },
): Result {
  const today = todayKey(input.now ?? new Date());
  const open = state.contacts.find(
    c =>
      c.supplierId === input.supplierId &&
      c.ingredientLabel.toLowerCase() === input.ingredientLabel.toLowerCase() &&
      c.status === 'sent',
  );
  if (open) {
    return ok(state);
  }
  return ok({
    ...state,
    contacts: [
      ...state.contacts,
      {
        id: makeId('contact'),
        supplierId: input.supplierId,
        ingredientId: input.ingredientId,
        ingredientLabel: input.ingredientLabel,
        sentOn: today,
        followUpOn: null,
        repliedOn: null,
        status: 'sent',
      },
    ],
  });
}

export function recordFollowUp(
  state: AppState,
  contactId: string,
  now: Date = new Date(),
): Result {
  const contact = state.contacts.find(c => c.id === contactId);
  if (!contact) {
    return fail('That email could not be found.');
  }
  if (contact.status !== 'sent' || contact.followUpOn) {
    return fail('A follow-up was already sent. The app only sends one.');
  }
  return ok({
    ...state,
    contacts: state.contacts.map(c =>
      c.id === contactId ? { ...c, followUpOn: todayKey(now) } : c,
    ),
  });
}

export interface SaveQuoteInput {
  supplierId: string;
  ingredientId: string;
  productName: string;
  packageSize: number;
  packageUnit: PackageUnit;
  priceCents: number;
  deliveryFeeCents?: number;
  minOrderQty?: number;
  deliveryNote?: string;
  seasonalNote?: string;
  now?: Date;
}

/**
 * Saves a vendor's quoted price as an offer, dated today. Because it is an
 * ordinary offer, the shopping helper considers it like any other.
 */
export function saveQuote(state: AppState, input: SaveQuoteInput): Result {
  const today = todayKey(input.now ?? new Date());
  const supplier = state.suppliers.find(s => s.id === input.supplierId);
  if (!supplier) {
    return fail('Save the vendor before adding a quote.');
  }
  if (!Number.isInteger(input.priceCents) || input.priceCents <= 0) {
    return fail('Enter the quoted price, greater than $0.00.');
  }
  if (!(input.packageSize > 0)) {
    return fail('Enter how much the quoted price buys, for example 1 kg.');
  }
  const ing = findIngredient(state, input.ingredientId);
  if (toBaseQuantity(input.packageSize, input.packageUnit, ing.unit) === null) {
    return fail(
      `${ing.name} is measured in ${ing.unit}. Enter the quote in ${
        ing.unit === 'g' ? 'g or kg' : ing.unit === 'mL' ? 'mL or L' : 'units'
      }.`,
    );
  }
  const offerId = `quote-${supplier.id}-${ing.id}`;
  const offer = {
    id: offerId,
    supplierId: supplier.id,
    ingredientId: ing.id,
    productName: input.productName.trim() || `${ing.name} (quoted)`,
    packageSize: input.packageSize,
    packageUnit: input.packageUnit,
    priceCents: input.priceCents,
    inStock: true,
    leadTimeDays: 1,
    source: 'quote' as const,
    quotedOn: today,
    minOrderQty: input.minOrderQty,
    deliveryNote: input.deliveryNote?.trim() || undefined,
    seasonalNote: input.seasonalNote?.trim() || undefined,
  };
  return ok({
    ...state,
    suppliers: state.suppliers.map(s =>
      s.id === supplier.id && input.deliveryFeeCents !== undefined
        ? { ...s, deliveryFeeCents: input.deliveryFeeCents }
        : s,
    ),
    offers: [...state.offers.filter(o => o.id !== offerId), offer],
    contacts: state.contacts.map(c =>
      c.supplierId === supplier.id &&
      c.status === 'sent' &&
      (c.ingredientId === ing.id || c.ingredientId === null)
        ? { ...c, status: 'replied', repliedOn: today }
        : c,
    ),
  });
}
