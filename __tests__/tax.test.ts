import { createSeedState } from '../src/data/seed';
import { previewSaleTax, sellTreat } from '../src/logic/actions';
import { taxSummary, treatStats } from '../src/logic/insights';
import { dayTotals, revenueOnDay } from '../src/logic/selectors';
import {
  calculateTax,
  Fulfilment,
  TaxLine,
  TaxProfile,
} from '../src/logic/tax';
import { AppState, Result } from '../src/types';
import { todayKey } from '../src/utils/format';

const TAKEAWAY_PARFAIT: TaxProfile = {
  taxClass: 'standard',
  preparedFoodRebateEligible: true,
  firstNationsRebateEligible: true,
};

const line = (
  unitPriceCents: number,
  profile: TaxProfile = TAKEAWAY_PARFAIT,
  quantity = 1,
): TaxLine => ({ label: 'Item', unitPriceCents, quantity, ...profile });

function tax(
  lines: TaxLine[],
  fulfilment: Fulfilment = 'takeaway',
  firstNationsVerified = false,
) {
  const r = calculateTax({ lines, fulfilment, firstNationsVerified });
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.breakdown;
}

describe('calculateTax (Ontario HST, demo rules)', () => {
  it('$10 taxable takeaway → $1.30 tax, $11.30 total', () => {
    const b = tax([line(1000)]);
    expect(b.taxChargedCents).toBe(130);
    expect(b.totalCents).toBe(1130);
  });

  it('same sale with verified First Nations relief → $0.50 tax, $10.50 total', () => {
    const b = tax([line(1000)], 'takeaway', true);
    expect(b.taxBeforeRebatesCents).toBe(130);
    expect(b.firstNationsRebateCents).toBe(80);
    expect(b.taxChargedCents).toBe(50);
    expect(b.totalCents).toBe(1050);
  });

  it('$10 dine-in sale → relief does not reduce the normal $1.30', () => {
    const b = tax([line(1000)], 'dine_in', true);
    expect(b.taxChargedCents).toBe(130);
    expect(b.firstNationsRebateCents).toBe(0);
    expect(b.notes.join(' ')).toMatch(/dine-in/);
  });

  it('catering also gets no First Nations relief', () => {
    expect(tax([line(1000)], 'catering', true).taxChargedCents).toBe(130);
  });

  it('$4.00 qualifying prepared food → $0.20 tax', () => {
    const b = tax([line(400)]);
    expect(b.taxChargedCents).toBe(20);
    expect(b.preparedFoodRebateCents).toBe(32);
  });

  it('$4.01 qualifying prepared food without other relief → $0.52 tax', () => {
    const b = tax([line(401)]);
    expect(b.taxChargedCents).toBe(52);
    expect(b.preparedFoodRebateCents).toBe(0);
  });

  it('two $3 items test the $6 transaction total → normal $0.78 tax', () => {
    const b = tax([line(300), line(300)]);
    expect(b.subtotalCents).toBe(600);
    expect(b.taxChargedCents).toBe(78);
    expect(b.preparedFoodRebateCents).toBe(0);
  });

  it('zero-rated item → no tax', () => {
    const b = tax([
      line(500, {
        taxClass: 'zero_rated',
        preparedFoodRebateEligible: false,
        firstNationsRebateEligible: false,
      }),
    ]);
    expect(b.taxBeforeRebatesCents).toBe(0);
    expect(b.taxChargedCents).toBe(0);
    expect(b.rule).toBe('Zero-rated (0%)');
  });

  it('already-rebated 5% sale plus First Nations eligibility stays at 5%', () => {
    const b = tax([line(400)], 'takeaway', true);
    expect(b.taxChargedCents).toBe(20);
    expect(b.preparedFoodRebateCents).toBe(32);
    expect(b.firstNationsRebateCents).toBe(0);
    expect(b.notes.join(' ')).toMatch(/do not stack/);
  });

  it('refuses products whose classification needs review', () => {
    const r = calculateTax({
      lines: [line(500, { ...TAKEAWAY_PARFAIT, taxClass: 'needs_review' })],
      fulfilment: 'takeaway',
      firstNationsVerified: false,
    });
    expect(r.ok).toBe(false);
  });
});

describe('tax in the app', () => {
  const NOW = new Date(2026, 9, 2, 14, 30);
  const TODAY = todayKey(NOW);
  const later = new Date(NOW.getTime() + 60_000);
  const unwrap = (r: Result): AppState => {
    if (!r.ok) {
      throw new Error(r.error);
    }
    return r.state;
  };
  const confirmed = {
    eligibleIncludingResidency: true,
    documentInspectedInPerson: true,
    purchaseQualifies: true,
  };

  it('saves the breakdown; revenue excludes tax, closing includes it', () => {
    const s0 = createSeedState(NOW);
    const before = dayTotals(s0, TODAY);
    const revenueBefore = revenueOnDay(s0, TODAY);
    const s = unwrap(
      sellTreat(s0, {
        treatId: 'apple',
        quantity: 2,
        payment: 'cash',
        fulfilment: 'takeaway',
        now: later,
      }),
    );
    const sale = s.sales[s.sales.length - 1];
    expect(sale.subtotalCents).toBe(1300);
    expect(sale.taxChargedCents).toBe(169);
    expect(sale.totalCents).toBe(1469);
    expect(sale.taxRule).toBe('HST 13%');
    expect(revenueOnDay(s, TODAY)).toBe(revenueBefore + 1300);
    expect(dayTotals(s, TODAY).cashSalesCents).toBe(before.cashSalesCents + 1469);
    const stats = treatStats(s, s.treats[0], 'today', TODAY);
    expect(stats.revenueCents).toBe(
      treatStats(s0, s0.treats[0], 'today', TODAY).revenueCents + 1300,
    );
  });

  it('relief sale stores a demo record without exposing it on the sale', () => {
    const s = unwrap(
      sellTreat(createSeedState(NOW), {
        treatId: 'apple',
        quantity: 1,
        payment: 'card',
        fulfilment: 'takeaway',
        firstNationsRelief: confirmed,
        now: later,
      }),
    );
    const sale = s.sales[s.sales.length - 1];
    expect(sale.taxChargedCents).toBe(Math.round(650 * 0.05));
    expect(sale.firstNationsRebateCents).toBeGreaterThan(0);
    const record = s.reliefRecords.find(r => r.id === sale.reliefRecordId)!;
    expect(record.demo).toBe(true);
    expect(JSON.stringify(sale)).not.toContain(record.documentReference);
  });

  it('rejects incomplete relief confirmations', () => {
    const r = sellTreat(createSeedState(NOW), {
      treatId: 'apple',
      quantity: 1,
      payment: 'card',
      fulfilment: 'takeaway',
      firstNationsRelief: { ...confirmed, documentInspectedInPerson: false },
      now: later,
    });
    expect(r.ok).toBe(false);
  });

  it('previewing relief changes nothing in state', () => {
    const s = createSeedState(NOW);
    const snapshot = JSON.stringify(s);
    previewSaleTax(s, 'apple', 1, 'takeaway', true);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('historical sales keep their tax when product settings change', () => {
    const s = createSeedState(NOW);
    const summaryBefore = taxSummary(s, 'week', TODAY);
    const changed: AppState = {
      ...s,
      treats: s.treats.map(t => ({
        ...t,
        tax: { ...t.tax, taxClass: 'zero_rated' as const },
      })),
    };
    expect(taxSummary(changed, 'week', TODAY)).toEqual(summaryBefore);
  });

  it('seeded week includes First Nations rebates in the summary', () => {
    const t = taxSummary(createSeedState(NOW), 'week', TODAY);
    expect(t.firstNationsRebatesCents).toBeGreaterThan(0);
    expect(t.netTaxCollectedCents).toBe(
      t.hstBeforeRebatesCents -
        t.preparedFoodRebatesCents -
        t.firstNationsRebatesCents,
    );
    expect(t.customerPaymentsCents).toBe(
      t.salesBeforeTaxCents + t.netTaxCollectedCents,
    );
  });
});
