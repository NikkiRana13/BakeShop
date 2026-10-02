import { createSeedState } from '../src/data/seed';
import {
  addStock,
  closeDay,
  computeClosing,
  makeBatch,
  sellTreat,
  wasteIngredient,
  wasteTreat,
} from '../src/logic/actions';
import {
  bestSeller,
  expiringIngredientAdvice,
  treatStats,
} from '../src/logic/insights';
import {
  batchRequirements,
  dayTotals,
  finishedStock,
  ingredientStatus,
  revenueOnDay,
} from '../src/logic/selectors';
import { planShopping } from '../src/logic/shopping';
import { AppState, Result } from '../src/types';
import { addDays, parseDollars, todayKey } from '../src/utils/format';

const NOW = new Date(2026, 9, 2, 14, 30);
const TODAY = todayKey(NOW);

function unwrap(r: Result): AppState {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.state;
}

const ing = (s: AppState, id: string) =>
  s.ingredients.find(i => i.id === id)!;

describe('seed data', () => {
  const s = createSeedState(NOW);

  it('has apples expiring in six days and low cream', () => {
    const apples = ingredientStatus(ing(s, 'apples'), TODAY);
    expect(apples.daysLeft).toBe(6);
    expect(apples.expiresSoon).toBe(true);
    expect(ingredientStatus(ing(s, 'cream'), TODAY).isLow).toBe(true);
  });

  it('keeps finished stock non-negative and consistent', () => {
    for (const t of s.treats) {
      expect(finishedStock(s, t.id)).toBeGreaterThanOrEqual(0);
    }
    expect(finishedStock(s, 'apple')).toBe(7);
  });

  it('includes a closing discrepancy yesterday', () => {
    const y = s.closings.find(c => c.date === addDays(TODAY, -1))!;
    expect(y.status).toBe('needs_review');
    expect(y.cashDiffCents).toBe(-500);
  });

  it('recommends using apples in the best seller', () => {
    expect(bestSeller(s, TODAY)?.treat.id).toBe('apple');
    const advice = expiringIngredientAdvice(s, TODAY)[0];
    expect(advice.body).toBe(
      'Your apples expire in six days, and Apple Crumble Parfait is your strongest seller. Consider a batch using those apples.',
    );
  });
});

describe('demo flow', () => {
  it('runs plan → buy → batch → sell → close', () => {
    let s = createSeedState(NOW);

    // 2. Planning a batch identifies missing cream.
    const reqs = batchRequirements(s, 'apple', 16, TODAY);
    const cream = reqs.find(r => r.ingredient.id === 'cream')!;
    expect(cream.missing).toBe(500);
    expect(unwrap.bind(null, makeBatch(s, 'apple', 16, NOW))).toThrow(
      /cream/,
    );

    // 3. Recommendation picks the cheapest eligible supplier.
    const plan = planShopping(s, 'apple', 16, TODAY, TODAY);
    expect(plan.lines).toHaveLength(1);
    const best = plan.lines[0].best!;
    expect(best.supplier.name).toBe('Valley Wholesale Foods');
    expect(best.packages).toBe(1);
    expect(best.totalCents).toBe(450);
    expect(best.reasons).toContain('Available today');
    expect(plan.lines[0].alternative?.supplier.isLocal).toBe(true);

    // 4. Adding received cream updates inventory and expenses.
    const expensesBefore = s.expenses.length;
    s = unwrap(
      addStock(s, {
        ingredientId: 'cream',
        quantity: 1000,
        costCents: 450,
        expiryDate: addDays(TODAY, 10),
        payment: 'card',
        supplierName: best.supplier.name,
        productName: best.offer.productName,
        now: NOW,
      }),
    );
    expect(ing(s, 'cream').quantity).toBe(1300);
    // Earlier expiry retained when combining.
    expect(ing(s, 'cream').expiryDate).toBe(addDays(TODAY, 9));
    expect(s.expenses).toHaveLength(expensesBefore + 1);
    expect(planShopping(s, 'apple', 16, TODAY, TODAY).everythingOnHand).toBe(
      true,
    );

    // 5. Making the batch deducts ingredients once and adds finished stock.
    const applesBefore = ing(s, 'apples').quantity;
    s = unwrap(makeBatch(s, 'apple', 16, NOW));
    expect(ing(s, 'apples').quantity).toBe(applesBefore - 16 * 80);
    expect(ing(s, 'cream').quantity).toBe(1300 - 800);
    expect(finishedStock(s, 'apple')).toBe(23);

    // 6. Selling does not deduct ingredients again.
    const revenueBefore = revenueOnDay(s, TODAY);
    const soldBefore = treatStats(s, s.treats[0], 'today', TODAY).unitsSold;
    const ingredientsSnapshot = JSON.stringify(s.ingredients);
    const later = new Date(NOW.getTime() + 60_000);
    s = unwrap(
      sellTreat(s, {
        treatId: 'apple',
        quantity: 3,
        payment: 'cash',
        fulfilment: 'takeaway',
        now: later,
      }),
    );
    expect(finishedStock(s, 'apple')).toBe(20);
    expect(JSON.stringify(s.ingredients)).toBe(ingredientsSnapshot);

    // 7. Revenue and insights update.
    expect(revenueOnDay(s, TODAY)).toBe(revenueBefore + 3 * 650);
    expect(treatStats(s, s.treats[0], 'today', TODAY).unitsSold).toBe(
      soldBefore + 3,
    );

    // Overselling is blocked.
    expect(
      sellTreat(s, {
        treatId: 'apple',
        quantity: 999,
        payment: 'card',
        fulfilment: 'takeaway',
        now: later,
      }).ok,
    ).toBe(false);

    // 8/9. Closing.
    const totals = dayTotals(s, TODAY);
    const expected = 10000 + totals.cashSalesCents - totals.cashExpensesCents;
    const wrong = computeClosing(s, TODAY, 10000, expected - 250, totals.cardSalesCents, later);
    expect(wrong.status).toBe('needs_review');
    expect(wrong.cashDiffCents).toBe(-250);
    const right = computeClosing(s, TODAY, 10000, expected, totals.cardSalesCents, later);
    expect(right.status).toBe('matched');
    s = unwrap(closeDay(s, right));
    expect(s.closings.find(c => c.date === TODAY)?.status).toBe('matched');
  });

  it('blocks negative stock on waste', () => {
    const s = createSeedState(NOW);
    expect(
      wasteIngredient(s, {
        ingredientId: 'cream',
        quantity: 5000,
        reason: 'Spilled',
        fromExpired: false,
        now: NOW,
      }).ok,
    ).toBe(false);
    expect(wasteTreat(s, 'apple', 8, 'Unsold', NOW).ok).toBe(false);
    const after = unwrap(wasteTreat(s, 'apple', 2, 'Unsold', NOW));
    expect(finishedStock(after, 'apple')).toBe(5);
  });

  it('excludes expired stock from usable inventory', () => {
    const s = createSeedState(NOW);
    const later = addDays(TODAY, 7);
    const st = ingredientStatus(ing(s, 'apples'), later);
    expect(st.usable).toBe(0);
    expect(st.expired).toBe(1500);
  });

  it('handles zero sales without division errors', () => {
    const s = createSeedState(NOW);
    const empty = { ...s, sales: [], batches: [], treatWaste: [] };
    const st = treatStats(empty, s.treats[0], 'week', TODAY);
    expect(st.sellThrough).toBeNull();
    expect(st.marginPct).toBeNull();
    expect(st.avgCostPerServingCents).toBeNull();
  });

  it('says no option qualifies when needed too soon', () => {
    const s = createSeedState(NOW);
    const noFarmYogurt = {
      ...s,
      ingredients: s.ingredients.map(i =>
        i.id === 'yogurt' ? { ...i, quantity: 0 } : i,
      ),
      offers: s.offers.filter(o => o.supplierId === 'valley' || o.ingredientId !== 'yogurt'),
    };
    const plan = planShopping(noFarmYogurt, 'apple', 1, TODAY, TODAY);
    const yogurt = plan.lines.find(l => l.ingredient.id === 'yogurt')!;
    expect(yogurt.best).toBeNull();
    expect(yogurt.excludedCount).toBe(1);
  });
});

test('parseDollars', () => {
  expect(parseDollars('4.50')).toBe(450);
  expect(parseDollars('$1,200.5')).toBe(120050);
  expect(parseDollars('abc')).toBeNull();
  expect(parseDollars('-3')).toBeNull();
});
