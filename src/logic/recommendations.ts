/**
 * Plain-language production suggestions for the "What's Selling?" tab.
 *
 * Everything comes from recorded batches, sales and waste. Suggestions only
 * use full days: today is still in progress, so it is never treated as a
 * complete day. Increases say "Try" because past sales cannot prove how many
 * extra servings would sell, and sell-outs are not counted as lost demand.
 */
import { AppState, Ingredient, Treat } from '../types';
import {
  addDays,
  daysBetween,
  formatCents,
  formatDate,
  formatQty,
  numberWord,
  relativeDays,
  todayKey,
} from '../utils/format';
import { RangeInput, resolveRange, treatStats, TreatStats } from './insights';
import { ingredientStatus } from './selectors';

export const HIGH_SELL_THROUGH = 0.9;
export const LOW_SELL_THROUGH = 0.6;
/** Strong sellers below this ingredient margin get a cost review instead. */
export const LOW_MARGIN = 0.5;
export const MIN_FULL_DAYS = 3;

export type RecKind =
  | 'reduce'
  | 'expiring'
  | 'increase'
  | 'buy_first'
  | 'top'
  | 'review_costs'
  | 'same'
  | 'track';

/** Lower comes first on screen. */
const PRIORITY: Record<RecKind, number> = {
  reduce: 1,
  expiring: 2,
  increase: 3,
  buy_first: 3,
  top: 4,
  review_costs: 5,
  same: 6,
  track: 7,
};

export interface Recommendation {
  id: string;
  kind: RecKind;
  treat: Treat;
  /** Prominent label, e.g. "Make 2 fewer batches". */
  label: string;
  /** One short sentence. */
  explanation: string;
  /** One or two short supporting stats. */
  stats: string[];
  /** "Most sold" badge when this treat sold the most (tied shown honestly). */
  mostSold: 'sole' | 'tied' | null;
  /** Raw values for "How we worked this out". */
  numbers: { label: string; value: string }[];
  /** Substituted arithmetic, one line each. */
  workings: string[];
  /** Suggested servings to plan, for linking to the batch/shopping forms. */
  servings?: number;
  priority: number;
}

export interface RecommendationSet {
  cards: Recommendation[];
  /** Full days used for suggestions, or null when there are none. */
  basis: { from: string; to: string; days: number } | null;
  /** Explains when today's partial day was left out. */
  basisNote: string | null;
}

function pct(n: number): number {
  return Math.round(n * 100);
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "next week" for 7 full days, otherwise "over the next N days". */
export function periodPhrase(days: number): string {
  return days === 7 ? 'next week' : `over the next ${numberWord(days)} days`;
}

/** Servings the usable ingredients on hand could make right now. */
export function servingsFromStock(
  state: AppState,
  treat: Treat,
  today: string,
): { max: number; limiting: Ingredient | null } {
  let max = Infinity;
  let limiting: Ingredient | null = null;
  for (const line of treat.recipe) {
    const ing = state.ingredients.find(i => i.id === line.ingredientId);
    if (!ing || line.quantity <= 0) {
      continue;
    }
    const n = Math.floor(ingredientStatus(ing, today).usable / line.quantity);
    if (n < max) {
      max = n;
      limiting = ing;
    }
  }
  return { max: max === Infinity ? 0 : max, limiting };
}

function baseNumbers(s: TreatStats, batchSize?: number) {
  const remaining = s.available - s.unitsSold - s.wasted;
  return [
    { label: 'Units sold', value: String(s.unitsSold) },
    { label: 'On hand at the start', value: String(s.openingStock) },
    { label: 'Units made', value: String(s.produced) },
    { label: 'Units left at the end', value: String(remaining) },
    { label: 'Units thrown away', value: String(s.wasted) },
    { label: 'Sales (before tax)', value: formatCents(s.revenueCents) },
    {
      label: 'Ingredient + packaging cost of units sold',
      value: formatCents(s.costOfSoldCents),
    },
    {
      label: 'Ingredient margin (no labour or overhead)',
      value: formatCents(s.marginCents),
    },
    {
      label: 'Batch size',
      value: batchSize ? `${batchSize} per batch` : 'Not set',
    },
  ];
}

function baseWorkings(s: TreatStats, batchSize?: number): string[] {
  const remaining = s.available - s.unitsSold - s.wasted;
  const lines = [
    `Available = ${s.openingStock} on hand at the start + ${s.produced} made = ${s.available}.`,
  ];
  if (s.available > 0) {
    lines.push(
      `You sold ${s.unitsSold} of ${s.available} available: ${s.unitsSold} ÷ ${s.available} = ${pct(
        s.unitsSold / s.available,
      )}%.`,
    );
  }
  lines.push(
    `Left at the end: ${s.available} − ${s.unitsSold} sold − ${s.wasted} thrown away = ${remaining}.`,
    `Ingredient margin: ${formatCents(s.revenueCents)} sales − ${formatCents(
      s.costOfSoldCents,
    )} ingredients and packaging = ${formatCents(
      s.marginCents,
    )}. Sales tax, labour, rent and other overhead are not included.`,
    batchSize
      ? `One batch makes ${batchSize} parfaits.`
      : 'No batch size is set, so suggestions are given in servings.',
  );
  return lines;
}

/** Full days inside the selected range (today is excluded until it ends). */
export function fullDayBasis(input: RangeInput, today: string) {
  const r = resolveRange(input, today);
  const lastFull = addDays(today, -1);
  const to = r.to < lastFull ? r.to : lastFull;
  if (r.from > to) {
    return { range: r, basis: null };
  }
  return {
    range: r,
    basis: { from: r.from, to, days: daysBetween(r.from, to) + 1 },
  };
}

export function buildRecommendations(
  state: AppState,
  input: RangeInput,
  today: string = todayKey(),
): RecommendationSet {
  const { range, basis } = fullDayBasis(input, today);
  const includesToday = range.to >= today && range.from <= today;
  const basisNote = !includesToday
    ? null
    : basis
    ? `Today isn't over yet, so suggestions use full days only: ${formatDate(
        basis.from,
      )} – ${formatDate(basis.to)}.`
    : "Today isn't over yet, so there are no full days to base suggestions on.";

  // Stats come from full days when there are any, otherwise from the
  // selected period as recorded so far.
  const statsInput: RangeInput = basis
    ? { from: basis.from, to: basis.to }
    : { from: range.from, to: range.to };
  const stats = state.treats.map(t => treatStats(state, t, statsInput, today));
  // The selected period as recorded so far (including today), so new
  // batches, sales and waste show up on the cards straight away.
  const periodInput: RangeInput = { from: range.from, to: range.to };
  const periodStats = new Map(
    state.treats.map(t => [t.id, treatStats(state, t, periodInput, today)]),
  );
  // Most sold = units sold in the selected period; ties are kept.
  const period = [...periodStats.values()];
  const maxSold = Math.max(0, ...period.map(x => x.unitsSold));
  const topIds = period
    .filter(x => maxSold > 0 && x.unitsSold === maxSold)
    .map(x => x.treat.id);
  const basisDiffers =
    !!basis && (basis.from !== range.from || basis.to !== range.to);

  const cards: Recommendation[] = [];
  for (const s of stats) {
    const treat = s.treat;
    const b = treat.batchSize;
    const p = periodStats.get(treat.id) ?? s;
    const remaining = p.available - p.unitsSold - p.wasted;
    const mostSold = topIds.includes(treat.id)
      ? topIds.length > 1
        ? 'tied'
        : 'sole'
      : null;
    const numbers = baseNumbers(p, b);
    const workings = [
      ...(basisDiffers && basis
        ? [
            `The numbers above include today so far. The suggestion uses only the ${plural(
              basis.days,
              'full day',
            )} ${formatDate(basis.from)} – ${formatDate(basis.to)}:`,
          ]
        : []),
      ...baseWorkings(s, b),
    ];
    const soldLeft = `${p.unitsSold} sold · ${remaining} left`;
    const marginStat = `${formatCents(p.marginCents)} ingredient margin`;
    const make = (
      kind: RecKind,
      label: string,
      explanation: string,
      statsLine: string[],
      extra: string[] = [],
      servings?: number,
    ): Recommendation => ({
      id: `${kind}-${treat.id}`,
      kind,
      treat,
      label,
      explanation,
      stats: statsLine,
      mostSold,
      numbers,
      workings: [...workings, ...extra],
      servings,
      priority: PRIORITY[kind],
    });

    const days = basis?.days ?? 0;
    if (!basis || days < MIN_FULL_DAYS || s.produced === 0) {
      const why = !basis
        ? 'Today is still going, so there is nothing complete to compare yet.'
        : days < MIN_FULL_DAYS
        ? `Only ${plural(days, 'full day')} recorded here; suggestions need at least ${MIN_FULL_DAYS}.`
        : 'No batches were made in this period.';
      cards.push(
        make('track', 'Keep tracking sales', why, [soldLeft], [
          `Suggestions need at least ${MIN_FULL_DAYS} full days with batches made.`,
        ]),
      );
      continue;
    }

    const sellThrough = s.available > 0 ? s.unitsSold / s.available : 0;
    const when = periodPhrase(days);

    // 1. Low sell-through with recorded waste: make less.
    if (sellThrough < LOW_SELL_THROUGH && s.wasted > 0) {
      const wasteLine = `${p.unitsSold} sold · ${p.wasted} thrown away`;
      if (b && s.wasted >= b) {
        const raw = s.wasted / b;
        const cut = Math.min(Math.floor(raw), Math.floor(s.produced / b));
        const extra = [
          `${s.wasted} thrown away ÷ ${b} per batch = ${raw.toFixed(
            2,
          )}, rounded down to ${cut}.`,
        ];
        if (cut < Math.floor(raw)) {
          extra.push(
            `Capped at the ${s.produced} you made: you can't cut more than you made.`,
          );
        }
        extra.push(
          `Reducing by ${plural(cut, 'batch', 'batches')} means making ${
            cut * b
          } fewer.`,
        );
        cards.push(
          make(
            'reduce',
            `Make ${plural(cut, 'fewer batch', 'fewer batches')} ${when}`,
            `Only ${pct(sellThrough)}% sold and ${s.wasted} were thrown away.`,
            [wasteLine],
            extra,
            cut * b,
          ),
        );
      } else {
        const cut = Math.min(s.wasted, s.produced);
        const extra = [
          b
            ? `${s.wasted} thrown away is less than one batch of ${b}, so make ${cut} fewer servings instead of a whole batch.`
            : `${s.wasted} thrown away, so make ${cut} fewer servings.`,
        ];
        cards.push(
          make(
            'reduce',
            `Make ${plural(cut, 'fewer serving', 'fewer servings')} ${when}`,
            `Only ${pct(sellThrough)}% sold and ${s.wasted} were thrown away.`,
            [wasteLine],
            extra,
            cut,
          ),
        );
      }
      continue;
    }

    // 2. Strong sales: check margin, then whether ingredients allow more.
    if (sellThrough >= HIGH_SELL_THROUGH && s.marginPct !== null) {
      if (s.marginPct < LOW_MARGIN) {
        cards.push(
          make(
            'review_costs',
            'Review ingredient costs',
            `It sells well, but only ${pct(
              s.marginPct,
            )}% of sales is left after ingredients.`,
            [soldLeft, marginStat],
            [
              `${pct(sellThrough)}% sold is strong, but the margin of ${pct(
                s.marginPct,
              )}% is below ${pct(LOW_MARGIN)}%. Check ingredient prices or the selling price.`,
            ],
          ),
        );
        continue;
      }
      if (s.marginPct > 0) {
        const extraServings = b ?? Math.max(1, Math.round(s.produced * 0.1));
        const unit = b ? 'Try 1 extra batch' : `Try ${extraServings} extra servings`;
        const stock = servingsFromStock(state, treat, today);
        const extra = [
          `${pct(sellThrough)}% sold is at least ${pct(
            HIGH_SELL_THROUGH,
          )}%, and the margin is positive.`,
          b
            ? `One extra batch means making ${b} more.`
            : `No batch size is set, so try 10% more: ${s.produced} × 10% ≈ ${extraServings}.`,
          'Past sales cannot prove how many extra will sell, so treat it as a test.',
          `Ingredients on hand now make ${stock.max} more; this needs ${extraServings}.`,
        ];
        if (stock.max < extraServings) {
          cards.push(
            make(
              'buy_first',
              'Buy ingredients first',
              `${unit} ${when}, but you only have ${
                stock.limiting?.name.toLowerCase() ?? 'ingredients'
              } for ${stock.max} more.`,
              [soldLeft, marginStat],
              extra,
              extraServings,
            ),
          );
        } else {
          cards.push(
            make(
              'increase',
              `${unit} ${when}`,
              `${pct(sellThrough)}% of what you made sold.`,
              [soldLeft, marginStat],
              extra,
              extraServings,
            ),
          );
        }
        continue;
      }
    }

    // 3. Otherwise steady. Leftovers alone are not proof of waste.
    const reason =
      sellThrough < LOW_SELL_THROUGH
        ? `Only ${pct(
            sellThrough,
          )}% sold, but nothing was thrown away, so no cut is suggested yet.`
        : `${pct(sellThrough)}% sold, which is a steady amount.`;
    const kind: RecKind = mostSold ? 'top' : 'same';
    cards.push(
      make(
        kind,
        mostSold ? 'Top seller' : 'Keep making the same amount',
        mostSold
          ? `Sold the most (${p.unitsSold}). Keep making the same amount.`
          : reason,
        [soldLeft, marginStat],
        [reason],
      ),
    );
  }

  cards.push(...expiringCards(state, stats, today));
  cards.sort((a, b) => a.priority - b.priority);
  return { cards, basis, basisNote };
}

/** Soon-expiring ingredients used by a treat that is selling. */
function expiringCards(
  state: AppState,
  stats: TreatStats[],
  today: string,
): Recommendation[] {
  const out: Recommendation[] = [];
  const bySold = [...stats].sort((a, b) => b.unitsSold - a.unitsSold);
  for (const ing of state.ingredients) {
    const st = ingredientStatus(ing, today);
    if (!st.expiresSoon || st.usable <= 0 || !ing.expiryDate) {
      continue;
    }
    const user = bySold.find(
      s =>
        s.unitsSold > 0 && s.treat.recipe.some(r => r.ingredientId === ing.id),
    );
    if (!user) {
      continue;
    }
    const perServing =
      user.treat.recipe.find(r => r.ingredientId === ing.id)?.quantity ?? 0;
    const servings = perServing > 0 ? Math.floor(st.usable / perServing) : 0;
    const strongest = bySold[0]?.treat.id === user.treat.id;
    const name = ing.name.toLowerCase();
    out.push({
      id: `expiring-${ing.id}-${user.treat.id}`,
      kind: 'expiring',
      treat: user.treat,
      label: `Use your ${name} soon`,
      explanation: `Your ${name} ${ing.plural ? 'expire' : 'expires'} ${relativeDays(
        st.daysLeft ?? 0,
      )}, and ${user.treat.name} ${
        strongest ? 'is your strongest seller' : 'is selling'
      }. Consider a batch using those ${name}.`,
      stats: [
        `${formatQty(st.usable, ing.unit)} ${name}`,
        `Enough for ${servings} parfaits`,
      ],
      mostSold: null,
      numbers: [
        { label: `${ing.name} on hand`, value: formatQty(st.usable, ing.unit) },
        { label: 'Expires', value: formatDate(ing.expiryDate) },
        {
          label: `${ing.name} per parfait`,
          value: formatQty(perServing, ing.unit),
        },
        { label: `${user.treat.name} sold`, value: String(user.unitsSold) },
      ],
      workings: [
        `${user.treat.name} uses ${formatQty(perServing, ing.unit)} ${name} per parfait.`,
        `${formatQty(st.usable, ing.unit)} ÷ ${formatQty(
          perServing,
          ing.unit,
        )} = ${servings} parfaits' worth before ${formatDate(ing.expiryDate)}.`,
        `${user.treat.name} sold ${user.unitsSold} in this period${
          strongest ? ', the most of any treat' : ''
        }.`,
      ],
      servings,
      priority: PRIORITY.expiring,
    });
  }
  return out;
}
