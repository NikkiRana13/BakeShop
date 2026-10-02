/**
 * Ontario HST at the point of sale — the one shared calculation used for
 * previews, saved sales, seed data and tests.
 *
 * Assumptions for this demo bakery: registered for GST/HST, located
 * off-reserve in Ontario, and menu prices exclude tax. All amounts are integer
 * cents. This is demo logic, not tax advice; confirm product classifications
 * and procedures with an accountant before real use.
 *
 * Rules:
 * - Taxable ("standard") supplies: 13% HST = 5% federal part + 8% Ontario part.
 * - Zero-rated supplies: 0%. Every product carries an explicit classification;
 *   nothing is assumed from the product name. Products marked "needs_review"
 *   cannot be sold until someone classifies them.
 * - Ontario point-of-sale rebate on prepared food and beverages: when the total
 *   pre-tax price of qualifying prepared food/beverages in the transaction is
 *   $4.00 or less, the 8% Ontario part is rebated at the till, for any
 *   customer. The threshold is tested on the transaction total, not per item.
 *   https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/gi-064/harmonized-sales-tax-ontario-point-sale-rebate-on-prepared-food-beverages.html
 * - Ontario First Nations point-of-sale rebate: for a purchaser whose
 *   eligibility staff verified in person, the 8% Ontario part is rebated on
 *   qualifying items. Not applied to dine-in restaurant meals or catering.
 *   https://www.ontario.ca/document/harmonized-sales-tax-hst/hst-ontario-first-nations-rebate
 * - Rebates never stack: an item already reduced to 5% gets no further cut.
 * - Full relief for property delivered to a reserve has separate conditions
 *   and is deliberately not implemented here.
 *   https://www.ontario.ca/document/harmonized-sales-tax-hst/hst-taxable-reserve-information
 *
 * Rounding: tax is computed once per transaction and rounded half-up to the
 * cent; rebates are the difference between tax before and after rebates.
 */

export const TAX_RULES_VERSION = 'ON-HST-demo-2026-10';
export const HST_BP = 1300;
export const FEDERAL_BP = 500;
export const ONTARIO_BP = 800;
export const PREPARED_FOOD_THRESHOLD_CENTS = 400;

export type TaxClass = 'standard' | 'zero_rated' | 'needs_review';
export type Fulfilment = 'takeaway' | 'dine_in' | 'catering';

/** Explicit per-product tax settings. */
export interface TaxProfile {
  taxClass: TaxClass;
  /** Counts toward the $4.00 Ontario prepared food/beverage rebate. */
  preparedFoodRebateEligible: boolean;
  /** Qualifies for the Ontario First Nations point-of-sale rebate. */
  firstNationsRebateEligible: boolean;
}

export interface TaxLine extends TaxProfile {
  label: string;
  unitPriceCents: number;
  quantity: number;
}

export interface TaxInput {
  lines: TaxLine[];
  fulfilment: Fulfilment;
  /** Staff completed the First Nations relief confirmation for this sale. */
  firstNationsVerified: boolean;
}

export interface TaxBreakdown {
  subtotalCents: number;
  taxBeforeRebatesCents: number;
  preparedFoodRebateCents: number;
  firstNationsRebateCents: number;
  taxChargedCents: number;
  totalCents: number;
  /** Plain-language rule applied, saved with the sale. */
  rule: string;
  rulesVersion: string;
  notes: string[];
}

export type TaxResult =
  | { ok: true; breakdown: TaxBreakdown }
  | { ok: false; error: string };

/** Half-up rounding of `cents × basis points`. */
function applyRate(cents: number, bp: number): number {
  return Math.round((cents * bp) / 10000);
}

export function calculateTax(input: TaxInput): TaxResult {
  const review = input.lines.find(l => l.taxClass === 'needs_review');
  if (review) {
    return {
      ok: false,
      error: `${review.label} has no tax classification yet. Set it before selling.`,
    };
  }
  const lineSub = (l: TaxLine) => l.unitPriceCents * l.quantity;
  const subtotalCents = input.lines.reduce((s, l) => s + lineSub(l), 0);
  const taxable = input.lines.filter(l => l.taxClass === 'standard');
  const taxableSub = taxable.reduce((s, l) => s + lineSub(l), 0);

  // Prepared-food rebate: transaction-level $4.00 threshold, any customer.
  const preparedSub = taxable
    .filter(l => l.preparedFoodRebateEligible)
    .reduce((s, l) => s + lineSub(l), 0);
  const preparedApplies =
    preparedSub > 0 && preparedSub <= PREPARED_FOOD_THRESHOLD_CENTS;
  const preparedRebatedSub = preparedApplies ? preparedSub : 0;

  // First Nations rebate: verified purchaser, takeaway only, and only on
  // items not already reduced to 5% (no stacking).
  const fnFulfilmentOk = input.fulfilment === 'takeaway';
  const fnCandidates = taxable.filter(l => l.firstNationsRebateEligible);
  const fnRebatedSub =
    input.firstNationsVerified && fnFulfilmentOk
      ? fnCandidates
          .filter(l => !(preparedApplies && l.preparedFoodRebateEligible))
          .reduce((s, l) => s + lineSub(l), 0)
      : 0;

  const reducedSub = preparedRebatedSub + fnRebatedSub;
  const taxBeforeRebatesCents = applyRate(taxableSub, HST_BP);
  const taxChargedCents = Math.round(
    ((taxableSub - reducedSub) * HST_BP + reducedSub * FEDERAL_BP) / 10000,
  );
  const totalRebate = taxBeforeRebatesCents - taxChargedCents;
  const preparedFoodRebateCents =
    preparedRebatedSub === 0
      ? 0
      : fnRebatedSub === 0
      ? totalRebate
      : applyRate(preparedRebatedSub, ONTARIO_BP);
  const firstNationsRebateCents = totalRebate - preparedFoodRebateCents;

  const notes: string[] = [];
  if (input.firstNationsVerified) {
    if (!fnFulfilmentOk) {
      notes.push(
        'First Nations relief is not applied to dine-in restaurant meals or catering.',
      );
    } else if (fnCandidates.length === 0) {
      notes.push(
        'This product is not set up as eligible for the First Nations rebate.',
      );
    } else if (fnRebatedSub === 0) {
      notes.push(
        'Already reduced to 5% by the prepared-food rebate; rebates do not stack.',
      );
    }
  }
  if (taxable.length < input.lines.length) {
    notes.push('Zero-rated items carry no HST.');
  }

  let rule: string;
  if (taxableSub === 0) {
    rule = 'Zero-rated (0%)';
  } else {
    const parts = ['HST 13%'];
    if (preparedRebatedSub > 0) {
      parts.push('Ontario prepared-food rebate (8%, total ≤ $4.00)');
    }
    if (fnRebatedSub > 0) {
      parts.push('Ontario First Nations point-of-sale rebate (8%)');
    }
    rule = parts.join(' less ');
  }

  return {
    ok: true,
    breakdown: {
      subtotalCents,
      taxBeforeRebatesCents,
      preparedFoodRebateCents,
      firstNationsRebateCents,
      taxChargedCents,
      totalCents: subtotalCents + taxChargedCents,
      rule,
      rulesVersion: TAX_RULES_VERSION,
      notes,
    },
  };
}
