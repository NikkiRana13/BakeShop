import { AppState, Ingredient, Treat } from '../types';
import { addDays, relativeDays, startOfDay, todayKey } from '../utils/format';
import { ingredientStatus } from './selectors';

export type Period = 'today' | 'week';

/** Inclusive range of local dates (YYYY-MM-DD). */
export interface DateRange {
  from: string;
  to: string;
}

export type RangeInput = Period | DateRange;

/** Resolves a preset or custom range to [start, end) timestamps. */
export function resolveRange(
  input: RangeInput,
  today: string,
): { from: string; to: string; start: number; end: number } {
  const r: DateRange =
    input === 'today'
      ? { from: today, to: today }
      : input === 'week'
      ? { from: addDays(today, -6), to: today }
      : input;
  return {
    ...r,
    start: startOfDay(r.from).getTime(),
    end: startOfDay(addDays(r.to, 1)).getTime(),
  };
}

export interface TreatStats {
  treat: Treat;
  unitsSold: number;
  revenueCents: number;
  /** FIFO cost of the servings sold in the period. */
  costOfSoldCents: number;
  avgCostPerServingCents: number | null;
  marginCents: number;
  marginPct: number | null;
  openingStock: number;
  produced: number;
  available: number;
  sellThrough: number | null;
  wasted: number;
  wasteCostCents: number;
}

type Event =
  | { kind: 0; time: number; qty: number; unitCost: number }
  | { kind: 1; time: number; qty: number; revenue: number }
  | { kind: 2; time: number; qty: number };

/**
 * Walks production, sales and waste in time order. Batches form FIFO lots,
 * so each sold serving carries the cost snapshot of the batch it came from.
 */
export function treatStats(
  state: AppState,
  treat: Treat,
  period: RangeInput,
  today: string = todayKey(),
): TreatStats {
  const { start, end } = resolveRange(period, today);
  const events: Event[] = [];
  for (const b of state.batches) {
    if (b.treatId === treat.id) {
      events.push({
        kind: 0,
        time: Date.parse(b.dateTime),
        qty: b.servings,
        unitCost: b.servings > 0 ? b.totalCostCents / b.servings : 0,
      });
    }
  }
  for (const s of state.sales) {
    if (s.treatId === treat.id) {
      events.push({
        kind: 1,
        time: Date.parse(s.dateTime),
        qty: s.quantity,
        // Revenue excludes sales tax.
        revenue: s.subtotalCents,
      });
    }
  }
  for (const w of state.treatWaste) {
    if (w.treatId === treat.id) {
      events.push({ kind: 2, time: Date.parse(w.dateTime), qty: w.quantity });
    }
  }
  events.sort((a, b) => a.time - b.time || a.kind - b.kind);

  const lots: { remaining: number; unitCost: number }[] = [];
  const consume = (qty: number): number => {
    let cost = 0;
    let left = qty;
    while (left > 0 && lots.length > 0) {
      const lot = lots[0];
      const take = Math.min(lot.remaining, left);
      cost += take * lot.unitCost;
      lot.remaining -= take;
      left -= take;
      if (lot.remaining === 0) {
        lots.shift();
      }
    }
    return cost;
  };

  let openingStock = 0;
  let produced = 0;
  let unitsSold = 0;
  let revenueCents = 0;
  let costOfSold = 0;
  let wasted = 0;
  let wasteCost = 0;
  for (const e of events) {
    const inPeriod = e.time >= start && e.time < end;
    if (e.kind === 0) {
      lots.push({ remaining: e.qty, unitCost: e.unitCost });
      if (e.time < start) {
        openingStock += e.qty;
      } else if (inPeriod) {
        produced += e.qty;
      }
    } else {
      const cost = consume(e.qty);
      if (e.time < start) {
        openingStock -= e.qty;
      } else if (inPeriod && e.kind === 1) {
        unitsSold += e.qty;
        revenueCents += e.revenue;
        costOfSold += cost;
      } else if (inPeriod) {
        wasted += e.qty;
        wasteCost += cost;
      }
    }
  }
  const costOfSoldCents = Math.round(costOfSold);
  const available = Math.max(0, openingStock) + produced;
  const marginCents = revenueCents - costOfSoldCents;
  return {
    treat,
    unitsSold,
    revenueCents,
    costOfSoldCents,
    avgCostPerServingCents:
      unitsSold > 0 ? Math.round(costOfSold / unitsSold) : null,
    marginCents,
    marginPct: revenueCents > 0 ? marginCents / revenueCents : null,
    openingStock: Math.max(0, openingStock),
    produced,
    available,
    sellThrough: available > 0 ? unitsSold / available : null,
    wasted,
    wasteCostCents: Math.round(wasteCost),
  };
}

export function allTreatStats(
  state: AppState,
  period: RangeInput,
  today: string = todayKey(),
): TreatStats[] {
  return state.treats.map(t => treatStats(state, t, period, today));
}

export function bestSeller(
  state: AppState,
  today: string = todayKey(),
): TreatStats | null {
  const stats = allTreatStats(state, 'week', today);
  const top = [...stats].sort(
    (a, b) => b.unitsSold - a.unitsSold || b.revenueCents - a.revenueCents,
  )[0];
  return top && top.unitsSold > 0 ? top : null;
}

export interface Advice {
  id: string;
  kind: 'larger' | 'smaller' | 'pricing' | 'expiring';
  title: string;
  body: string;
  treatId?: string;
}

export const HIGH_SELL_THROUGH = 0.85;
export const LOW_SELL_THROUGH = 0.6;
export const HIGH_WASTE_SHARE = 0.2;
export const LOW_MARGIN = 0.5;

function expiryPhrase(ing: Ingredient, days: number): string {
  const verb = ing.plural ? 'expire' : 'expires';
  return `Your ${ing.name.toLowerCase()} ${verb} ${relativeDays(days)}`;
}

/** Rule-based suggestion linking soon-expiring stock with the best seller. */
export function expiringIngredientAdvice(
  state: AppState,
  today: string = todayKey(),
): Advice[] {
  const stats = allTreatStats(state, 'week', today).sort(
    (a, b) => b.unitsSold - a.unitsSold,
  );
  const top = stats[0];
  const advice: Advice[] = [];
  const expiring = state.ingredients
    .map(ing => ({ ing, st: ingredientStatus(ing, today) }))
    .filter(x => x.st.expiresSoon && x.st.usable > 0)
    .sort((a, b) => (a.st.daysLeft ?? 0) - (b.st.daysLeft ?? 0));
  for (const { ing, st } of expiring) {
    const users = stats.filter(
      s =>
        s.unitsSold > 0 &&
        s.treat.recipe.some(r => r.ingredientId === ing.id),
    );
    // `stats` is already sorted by units sold, so this is the most popular user.
    const user = users[0];
    if (!user) {
      continue;
    }
    const strongest = top && top.treat.id === user.treat.id;
    advice.push({
      id: `expiring-${ing.id}`,
      kind: 'expiring',
      treatId: user.treat.id,
      title: `Use your ${ing.name.toLowerCase()} soon`,
      body: `${expiryPhrase(ing, st.daysLeft ?? 0)}, and ${user.treat.name} ${
        strongest
          ? 'is your strongest seller'
          : `sold ${user.unitsSold} this week`
      }. Consider a batch using those ${ing.name.toLowerCase()}.`,
    });
  }
  return advice;
}

export function salesAdvice(
  state: AppState,
  period: RangeInput,
  today: string = todayKey(),
): Advice[] {
  const advice: Advice[] = [];
  const stats = allTreatStats(state, period, today);
  const maxSold = Math.max(0, ...stats.map(s => s.unitsSold));
  for (const s of stats) {
    const name = s.treat.name;
    if (s.sellThrough === null) {
      continue;
    }
    const wasteShare = s.available > 0 ? s.wasted / s.available : 0;
    if (
      s.sellThrough >= HIGH_SELL_THROUGH &&
      s.marginPct !== null &&
      s.marginPct > 0
    ) {
      advice.push({
        id: `larger-${s.treat.id}`,
        kind: 'larger',
        treatId: s.treat.id,
        title: `Consider a larger ${name} batch`,
        body: `${Math.round(
          s.sellThrough * 100,
        )}% of available servings sold with a positive ingredient margin. A slightly bigger batch may meet demand.`,
      });
    } else if (
      s.sellThrough < LOW_SELL_THROUGH ||
      wasteShare >= HIGH_WASTE_SHARE
    ) {
      advice.push({
        id: `smaller-${s.treat.id}`,
        kind: 'smaller',
        treatId: s.treat.id,
        title: `Consider a smaller ${name} batch`,
        body: `${Math.round(s.sellThrough * 100)}% sold and ${
          s.wasted
        } serving${
          s.wasted === 1 ? '' : 's'
        } wasted. A smaller batch may reduce waste.`,
      });
    }
    if (
      maxSold > 0 &&
      s.unitsSold >= maxSold * 0.5 &&
      s.marginPct !== null &&
      s.marginPct < LOW_MARGIN
    ) {
      advice.push({
        id: `pricing-${s.treat.id}`,
        kind: 'pricing',
        treatId: s.treat.id,
        title: `Review ${name} costs or price`,
        body: `It sells well, but the ingredient margin is only ${Math.round(
          s.marginPct * 100,
        )}%. Check ingredient costs or the selling price.`,
      });
    }
  }
  return [...expiringIngredientAdvice(state, today), ...advice];
}

export interface TaxSummary {
  salesBeforeTaxCents: number;
  hstBeforeRebatesCents: number;
  preparedFoodRebatesCents: number;
  firstNationsRebatesCents: number;
  netTaxCollectedCents: number;
  customerPaymentsCents: number;
  /** Only tax amounts explicitly recorded on supplier purchases. */
  taxPaidOnPurchasesCents: number;
  purchasesWithoutRecordedTax: number;
}

/** Sums the tax breakdowns saved with each sale; nothing is recalculated. */
export function taxSummary(
  state: AppState,
  period: RangeInput,
  today: string = todayKey(),
): TaxSummary {
  const { start, end } = resolveRange(period, today);
  const inPeriod = (iso: string) => {
    const t = Date.parse(iso);
    return t >= start && t < end;
  };
  const sum: TaxSummary = {
    salesBeforeTaxCents: 0,
    hstBeforeRebatesCents: 0,
    preparedFoodRebatesCents: 0,
    firstNationsRebatesCents: 0,
    netTaxCollectedCents: 0,
    customerPaymentsCents: 0,
    taxPaidOnPurchasesCents: 0,
    purchasesWithoutRecordedTax: 0,
  };
  for (const s of state.sales) {
    if (inPeriod(s.dateTime)) {
      sum.salesBeforeTaxCents += s.subtotalCents;
      sum.hstBeforeRebatesCents += s.taxBeforeRebatesCents;
      sum.preparedFoodRebatesCents += s.preparedFoodRebateCents;
      sum.firstNationsRebatesCents += s.firstNationsRebateCents;
      sum.netTaxCollectedCents += s.taxChargedCents;
      sum.customerPaymentsCents += s.totalCents;
    }
  }
  for (const e of state.expenses) {
    if (inPeriod(e.dateTime)) {
      if (e.taxPaidCents === undefined) {
        sum.purchasesWithoutRecordedTax += 1;
      } else {
        sum.taxPaidOnPurchasesCents += e.taxPaidCents;
      }
    }
  }
  return sum;
}
