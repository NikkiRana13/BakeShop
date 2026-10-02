import { AppState, Ingredient, Sale, Treat } from '../types';
import { daysBetween, todayKey } from '../utils/format';

export const EXPIRY_WINDOW_DAYS = 7;

export interface IngredientStatus {
  usable: number;
  expired: number;
  /** Days until the active stock expires; null when no active stock. */
  daysLeft: number | null;
  isLow: boolean;
  expiresSoon: boolean;
  hasExpired: boolean;
}

export function ingredientStatus(
  ing: Ingredient,
  today: string = todayKey(),
): IngredientStatus {
  const daysLeft =
    ing.expiryDate && ing.quantity > 0
      ? daysBetween(today, ing.expiryDate)
      : null;
  const activeExpired = daysLeft !== null && daysLeft < 0;
  const usable = activeExpired ? 0 : ing.quantity;
  const expired = ing.expiredQuantity + (activeExpired ? ing.quantity : 0);
  return {
    usable,
    expired,
    daysLeft,
    isLow: usable < ing.lowStockThreshold,
    expiresSoon:
      daysLeft !== null && daysLeft >= 0 && daysLeft <= EXPIRY_WINDOW_DAYS,
    hasExpired: expired > 0,
  };
}

export function findIngredient(state: AppState, id: string): Ingredient {
  const ing = state.ingredients.find(i => i.id === id);
  if (!ing) {
    throw new Error(`Unknown ingredient ${id}`);
  }
  return ing;
}

export function findTreat(state: AppState, id: string): Treat {
  const t = state.treats.find(x => x.id === id);
  if (!t) {
    throw new Error(`Unknown treat ${id}`);
  }
  return t;
}

/** Finished servings on hand: everything produced minus sold minus wasted. */
export function finishedStock(state: AppState, treatId: string): number {
  let n = 0;
  for (const b of state.batches) {
    if (b.treatId === treatId) {
      n += b.servings;
    }
  }
  for (const s of state.sales) {
    if (s.treatId === treatId) {
      n -= s.quantity;
    }
  }
  for (const w of state.treatWaste) {
    if (w.treatId === treatId) {
      n -= w.quantity;
    }
  }
  return n;
}

export interface RequirementLine {
  ingredient: Ingredient;
  needed: number;
  available: number;
  missing: number;
}

export function batchRequirements(
  state: AppState,
  treatId: string,
  servings: number,
  today: string = todayKey(),
): RequirementLine[] {
  const treat = findTreat(state, treatId);
  return treat.recipe.map(line => {
    const ingredient = findIngredient(state, line.ingredientId);
    const needed = line.quantity * servings;
    const available = ingredientStatus(ingredient, today).usable;
    return {
      ingredient,
      needed,
      available,
      missing: Math.max(0, needed - available),
    };
  });
}

export function estimateBatchCost(
  state: AppState,
  treatId: string,
  servings: number,
): { ingredientCents: number; packagingCents: number; totalCents: number } {
  const treat = findTreat(state, treatId);
  let ingredientCents = 0;
  for (const line of treat.recipe) {
    const ing = findIngredient(state, line.ingredientId);
    ingredientCents += line.quantity * servings * ing.costPerUnitCents;
  }
  ingredientCents = Math.round(ingredientCents);
  const packagingCents = treat.packagingCostCents * servings;
  return {
    ingredientCents,
    packagingCents,
    totalCents: ingredientCents + packagingCents,
  };
}

function inDay(iso: string, day: string): boolean {
  return todayKey(new Date(iso)) === day;
}

export function salesOnDay(state: AppState, day: string) {
  return state.sales.filter(s => inDay(s.dateTime, day));
}

/** Sales revenue for the day, excluding sales tax. */
export function revenueOnDay(state: AppState, day: string): number {
  return salesOnDay(state, day).reduce((sum, s) => sum + s.subtotalCents, 0);
}

export interface DayTotals {
  cashSalesCents: number;
  cardSalesCents: number;
  cashExpensesCents: number;
  cardExpensesCents: number;
  unpaidExpensesCents: number;
}

export function dayTotals(state: AppState, day: string): DayTotals {
  const t: DayTotals = {
    cashSalesCents: 0,
    cardSalesCents: 0,
    cashExpensesCents: 0,
    cardExpensesCents: 0,
    unpaidExpensesCents: 0,
  };
  // Closing compares money actually taken, so sales include tax charged.
  for (const s of state.sales) {
    if (inDay(s.dateTime, day)) {
      if (s.payment === 'cash') {
        t.cashSalesCents += s.totalCents;
      } else {
        t.cardSalesCents += s.totalCents;
      }
    }
  }
  for (const e of state.expenses) {
    if (inDay(e.dateTime, day)) {
      if (e.payment === 'cash') {
        t.cashExpensesCents += e.amountCents;
      } else if (e.payment === 'card') {
        t.cardExpensesCents += e.amountCents;
      } else {
        t.unpaidExpensesCents += e.amountCents;
      }
    }
  }
  return t;
}

export interface LedgerEntry {
  id: string;
  dateTime: string;
  description: string;
  /** Positive for money in, negative for money out. */
  amountCents: number;
  payment: 'cash' | 'card' | 'unpaid';
  category: 'Sale' | 'Ingredients';
  /** The sale itself, for receipt details. */
  sale?: Sale;
}

export function ledgerForDay(state: AppState, day: string): LedgerEntry[] {
  return ledgerForRange(state, day, day);
}

/** Ledger for an inclusive range of local dates, newest first. */
export function ledgerForRange(
  state: AppState,
  from: string,
  to: string,
): LedgerEntry[] {
  const inRange = (iso: string) => {
    const d = todayKey(new Date(iso));
    return d >= from && d <= to;
  };
  const entries: LedgerEntry[] = [];
  for (const s of state.sales) {
    if (inRange(s.dateTime)) {
      const treat = state.treats.find(t => t.id === s.treatId);
      entries.push({
        id: s.id,
        dateTime: s.dateTime,
        description: `${s.quantity} × ${treat?.name ?? 'Treat'}`,
        amountCents: s.totalCents,
        payment: s.payment,
        category: 'Sale',
        sale: s,
      });
    }
  }
  for (const e of state.expenses) {
    if (inRange(e.dateTime)) {
      entries.push({
        id: e.id,
        dateTime: e.dateTime,
        description: e.description,
        amountCents: -e.amountCents,
        payment: e.payment,
        category: 'Ingredients',
      });
    }
  }
  return entries.sort((a, b) => b.dateTime.localeCompare(a.dateTime));
}
