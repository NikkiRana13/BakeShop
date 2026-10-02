import { createSeedState } from '../src/data/seed';
import {
  addStock,
  makeBatch,
  sellTreat,
  setBatchSize,
  wasteTreat,
} from '../src/logic/actions';
import {
  buildRecommendations,
  Recommendation,
} from '../src/logic/recommendations';
import { AppState, Result } from '../src/types';
import { addDays, todayKey } from '../src/utils/format';

const NOW = new Date(2026, 9, 2, 14, 30);
const TODAY = todayKey(NOW);
const later = new Date(NOW.getTime() + 60_000);

const unwrap = (r: Result): AppState => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.state;
};
const recsFor = (s: AppState, treatId: string, input: any = 'week') =>
  buildRecommendations(s, input, TODAY).cards.filter(
    c => c.treat.id === treatId && c.kind !== 'expiring',
  );
const one = (s: AppState, treatId: string, input: any = 'week') => {
  const r = recsFor(s, treatId, input);
  expect(r).toHaveLength(1);
  return r[0] as Recommendation;
};

describe('What’s Selling recommendations (seeded week)', () => {
  const s = createSeedState(NOW);
  const set = buildRecommendations(s, 'week', TODAY);

  it('leaves out the unfinished day and says so', () => {
    expect(set.basis).toEqual({
      from: addDays(TODAY, -6),
      to: addDays(TODAY, -1),
      days: 6,
    });
    expect(set.basisNote).toMatch(/full days only/);
  });

  it('pumpkin: low sell-through with waste → 2 fewer batches of 8', () => {
    const r = one(s, 'pumpkin');
    expect(r.kind).toBe('reduce');
    expect(r.label).toBe('Make 2 fewer batches over the next six days');
    expect(r.servings).toBe(16);
    expect(r.workings).toContain(
      '23 thrown away ÷ 8 per batch = 2.88, rounded down to 2.',
    );
    expect(r.workings).toContain(
      'Reducing by 2 batches means making 16 fewer.',
    );
    expect(r.workings).toContain(
      'You sold 29 of 52 available: 29 ÷ 52 = 56%.',
    );
  });

  it('apple: strong sales but not enough cream → Buy ingredients first', () => {
    const r = one(s, 'apple');
    expect(r.kind).toBe('buy_first');
    expect(r.explanation).toMatch(
      /^Try 1 extra batch over the next six days, but you only have cream for 6 more/,
    );
    expect(r.mostSold).toBe('sole');
  });

  it('apple: once cream arrives → Try 1 extra batch', () => {
    const withCream = unwrap(
      addStock(s, {
        ingredientId: 'cream',
        quantity: 1000,
        costCents: 450,
        expiryDate: addDays(TODAY, 10),
        payment: 'card',
        supplierName: 'Valley Wholesale Foods',
        now: NOW,
      }),
    );
    const r = one(withCream, 'apple');
    expect(r.kind).toBe('increase');
    expect(r.label).toBe('Try 1 extra batch over the next six days');
    expect(r.servings).toBe(12);
    expect(r.workings).toContain('One extra batch means making 12 more.');
  });

  it('chocolate: middling sell-through → keep the same amount', () => {
    const r = one(s, 'chocolate');
    expect(r.kind).toBe('same');
    expect(r.label).toBe('Keep making the same amount');
  });

  it('orders reduce, expiring, increase, then the rest', () => {
    expect(set.cards.map(c => c.kind)).toEqual([
      'reduce',
      'expiring',
      'buy_first',
      'same',
    ]);
    expect(set.cards[1].explanation).toBe(
      'Your apples expire in six days, and Apple Crumble Parfait is your strongest seller. Consider a batch using those apples.',
    );
  });
});

describe('rules', () => {
  const s = createSeedState(NOW);

  it('Today has no full days → Keep tracking sales', () => {
    const cards = buildRecommendations(s, 'today', TODAY).cards.filter(
      c => c.kind !== 'expiring',
    );
    expect(cards.every(c => c.kind === 'track')).toBe(true);
    expect(cards[0].label).toBe('Keep tracking sales');
  });

  it('fewer than 3 full days → Keep tracking sales', () => {
    const r = one(s, 'pumpkin', {
      from: addDays(TODAY, -2),
      to: addDays(TODAY, -1),
    });
    expect(r.kind).toBe('track');
  });

  it('a full past week reads "next week"', () => {
    const r = one(s, 'pumpkin', {
      from: addDays(TODAY, -7),
      to: addDays(TODAY, -1),
    });
    expect(r.label).toMatch(/next week$/);
  });

  it('no batch size → advice in servings, not invented batches', () => {
    const noSize = unwrap(setBatchSize(s, 'pumpkin', null));
    const r = one(noSize, 'pumpkin');
    expect(r.label).toBe('Make 23 fewer servings over the next six days');
    expect(r.workings).toContain(
      'No batch size is set, so suggestions are given in servings.',
    );
  });

  it('waste under one batch → fewer servings, not a batch', () => {
    const big = unwrap(setBatchSize(s, 'pumpkin', 30));
    const r = one(big, 'pumpkin');
    expect(r.label).toBe('Make 23 fewer servings over the next six days');
    expect(r.workings.join(' ')).toMatch(/less than one batch of 30/);
  });

  it('leftovers without recorded waste are not treated as waste', () => {
    const noWaste = { ...s, treatWaste: [] };
    const r = one(noWaste, 'pumpkin');
    expect(r.kind).not.toBe('reduce');
  });

  it('strong sales with low margin → Review ingredient costs', () => {
    const pricey: AppState = {
      ...s,
      batches: s.batches.map(b =>
        b.treatId === 'apple'
          ? { ...b, totalCostCents: b.servings * 500 }
          : b,
      ),
    };
    const r = one(pricey, 'apple');
    expect(r.kind).toBe('review_costs');
    expect(r.label).toBe('Review ingredient costs');
  });

  it('shows ties honestly', () => {
    const appleSales = s.sales.filter(x => x.treatId === 'apple');
    const appleSold = appleSales.reduce((n, x) => n + x.quantity, 0);
    const chocSold = s.sales
      .filter(x => x.treatId === 'chocolate')
      .reduce((n, x) => n + x.quantity, 0);
    // Drop apple sales until both treats sold the same number.
    let excess = appleSold - chocSold;
    const kept = s.sales.filter(x => {
      if (x.treatId === 'apple' && excess >= x.quantity) {
        excess -= x.quantity;
        return false;
      }
      return true;
    });
    expect(excess).toBe(0);
    const tied = { ...s, sales: kept };
    const cards = buildRecommendations(tied, 'week', TODAY).cards;
    const most = cards.filter(c => c.mostSold);
    expect(most.map(c => c.treat.id).sort()).toEqual(['apple', 'chocolate']);
    expect(most.every(c => c.mostSold === 'tied')).toBe(true);
  });

  it('new sales, batches and waste update the cards immediately', () => {
    const before = one(s, 'chocolate').stats[0];
    let next = unwrap(
      sellTreat(s, {
        treatId: 'chocolate',
        quantity: 2,
        payment: 'cash',
        fulfilment: 'takeaway',
        now: later,
      }),
    );
    next = unwrap(wasteTreat(next, 'chocolate', 1, 'Dropped', later));
    expect(before).toBe('50 sold · 5 left');
    expect(one(next, 'chocolate').stats[0]).toBe('52 sold · 2 left');
    next = unwrap(makeBatch(next, 'chocolate', 4, later));
    expect(one(next, 'chocolate').stats[0]).toBe('52 sold · 6 left');
  });

  it('revenue and margin exclude sales tax', () => {
    const r = one(s, 'chocolate');
    const sales = r.numbers.find(n => n.label === 'Sales (before tax)')!;
    // 50 chocolate parfaits at $7.00 before tax.
    expect(sales.value).toBe('$350.00');
  });
});
