import { AppState, Ingredient, Supplier, SupplierOffer } from '../types';
import { addDays, daysBetween, todayKey, toBaseQuantity } from '../utils/format';
import { batchRequirements } from './selectors';

export interface OfferOption {
  offer: SupplierOffer;
  supplier: Supplier;
  packages: number;
  /** Size of one package in the ingredient's base unit. */
  baseSize: number;
  totalCents: number;
  availableDate: string;
  reasons: string[];
}

export interface ShoppingLine {
  ingredient: Ingredient;
  missing: number;
  best: OfferOption | null;
  alternative: OfferOption | null;
  /** Offers excluded because they are out of stock or arrive too late. */
  excludedCount: number;
}

export interface ShoppingPlan {
  lines: ShoppingLine[];
  everythingOnHand: boolean;
}

export function planShopping(
  state: AppState,
  treatId: string,
  servings: number,
  neededBy: string,
  today: string = todayKey(),
): ShoppingPlan {
  const reqs = batchRequirements(state, treatId, servings, today);
  const lines: ShoppingLine[] = [];
  for (const req of reqs) {
    if (req.missing <= 1e-9) {
      continue;
    }
    const options: OfferOption[] = [];
    let excludedCount = 0;
    for (const offer of state.offers) {
      if (offer.ingredientId !== req.ingredient.id) {
        continue;
      }
      const supplier = state.suppliers.find(s => s.id === offer.supplierId);
      const baseSize = toBaseQuantity(
        offer.packageSize,
        offer.packageUnit,
        req.ingredient.unit,
      );
      if (!supplier || !baseSize || baseSize <= 0) {
        continue;
      }
      const availableDate = addDays(today, offer.leadTimeDays);
      if (!offer.inStock || daysBetween(availableDate, neededBy) < 0) {
        excludedCount += 1;
        continue;
      }
      const packages = Math.ceil(req.missing / baseSize - 1e-9);
      options.push({
        offer,
        supplier,
        packages,
        baseSize,
        totalCents: packages * offer.priceCents,
        availableDate,
        reasons: [],
      });
    }
    options.sort(
      (a, b) =>
        a.totalCents - b.totalCents ||
        a.availableDate.localeCompare(b.availableDate),
    );
    const best = options[0] ?? null;
    let alternative: OfferOption | null = null;
    if (best) {
      best.reasons.push(
        options.length > 1
          ? 'Lowest purchase cost among listed options'
          : 'Only listed option available in time',
      );
      if (best.offer.leadTimeDays === 0) {
        best.reasons.push('Available today');
      }
      if (best.supplier.isLocal) {
        best.reasons.push('Local option');
      }
      const rest = options.slice(1);
      alternative =
        rest.find(o => o.supplier.isLocal && !best.supplier.isLocal) ??
        rest.find(o => o.availableDate < best.availableDate) ??
        rest[0] ??
        null;
      if (alternative) {
        if (alternative.supplier.isLocal) {
          alternative.reasons.push('Local option');
        }
        if (alternative.offer.leadTimeDays === 0) {
          alternative.reasons.push('Available today');
        }
        if (alternative.reasons.length === 0) {
          alternative.reasons.push('Next lowest purchase cost');
        }
      }
    }
    lines.push({
      ingredient: req.ingredient,
      missing: req.missing,
      best,
      alternative,
      excludedCount,
    });
  }
  return { lines, everythingOnHand: lines.length === 0 };
}
