import { rangeError } from '../src/components/DateRangePicker';
import { createSeedState } from '../src/data/seed';
import { allTreatStats, resolveRange, taxSummary } from '../src/logic/insights';
import { ledgerForDay, ledgerForRange } from '../src/logic/selectors';
import { addDays, todayKey } from '../src/utils/format';

const NOW = new Date(2026, 9, 2, 14, 30);
const TODAY = todayKey(NOW);
const s = createSeedState(NOW);
const lastWeek = { from: addDays(TODAY, -6), to: TODAY };

describe('custom date ranges', () => {
  it('a custom range matching a preset gives identical results', () => {
    expect(allTreatStats(s, lastWeek, TODAY)).toEqual(
      allTreatStats(s, 'week', TODAY),
    );
    expect(taxSummary(s, { from: TODAY, to: TODAY }, TODAY)).toEqual(
      taxSummary(s, 'today', TODAY),
    );
  });

  it('includes both end dates', () => {
    const r = resolveRange({ from: TODAY, to: TODAY }, TODAY);
    expect(r.end - r.start).toBe(24 * 3600 * 1000);
  });

  it('narrower ranges only count their own days', () => {
    const yesterday = addDays(TODAY, -1);
    const one = taxSummary(s, { from: yesterday, to: yesterday }, TODAY);
    const two = taxSummary(s, { from: yesterday, to: TODAY }, TODAY);
    const today = taxSummary(s, 'today', TODAY);
    expect(two.salesBeforeTaxCents).toBe(
      one.salesBeforeTaxCents + today.salesBeforeTaxCents,
    );
  });

  it('ranges with no activity show zero without errors', () => {
    // Before any seeded history: nothing on hand, made or sold.
    const before = { from: addDays(TODAY, -60), to: addDays(TODAY, -30) };
    const stats = allTreatStats(s, before, TODAY);
    expect(stats.every(x => x.unitsSold === 0 && x.sellThrough === null)).toBe(
      true,
    );
    expect(taxSummary(s, before, TODAY).customerPaymentsCents).toBe(0);
    // A future range starts with today's leftovers on hand: 0%, not "none".
    const future = { from: addDays(TODAY, 30), to: addDays(TODAY, 40) };
    const apple = allTreatStats(s, future, TODAY).find(
      x => x.treat.id === 'apple',
    )!;
    expect(apple.available).toBe(7);
    expect(apple.sellThrough).toBe(0);
  });

  it('ledger range is the union of its days', () => {
    const days = [addDays(TODAY, -2), addDays(TODAY, -1), TODAY];
    const union = days.flatMap(d => ledgerForDay(s, d)).length;
    expect(ledgerForRange(s, days[0], TODAY)).toHaveLength(union);
  });

  it('validates typed ranges', () => {
    expect(rangeError('2026-10-01', '2026-10-02')).toBeNull();
    expect(rangeError('2026-10-03', '2026-10-02')).toMatch(/on or before/);
    expect(rangeError('2026-13-01', '2026-10-02')).toMatch(/YYYY-MM-DD/);
    expect(rangeError('2024-01-01', '2026-10-02')).toMatch(/one year/);
  });
});
