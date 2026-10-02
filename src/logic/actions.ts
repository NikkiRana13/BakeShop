/**
 * Pure state transitions. Each returns a new state or a plain-language error,
 * and never lets stock go negative.
 */
import {
  AppState,
  Closing,
  ExpensePayment,
  ReliefConfirmation,
  Result,
  SalePayment,
} from '../types';
import { calculateTax, Fulfilment, TaxResult } from './tax';
import { daysBetween, makeId, roundQty, todayKey } from '../utils/format';
import {
  batchRequirements,
  dayTotals,
  estimateBatchCost,
  findIngredient,
  findTreat,
  finishedStock,
  ingredientStatus,
} from './selectors';

const ok = (state: AppState): Result => ({ ok: true, state });
const fail = (error: string): Result => ({ ok: false, error });

export interface AddStockInput {
  ingredientId: string;
  quantity: number;
  costCents: number;
  expiryDate: string;
  payment: ExpensePayment;
  supplierName: string;
  productName?: string;
  /** Tax shown on the supplier receipt, if Grandma records it. */
  taxPaidCents?: number;
  now?: Date;
}

export function addStock(state: AppState, input: AddStockInput): Result {
  const now = input.now ?? new Date();
  const today = todayKey(now);
  if (!(input.quantity > 0)) {
    return fail('Enter a quantity greater than zero.');
  }
  if (!Number.isInteger(input.costCents) || input.costCents <= 0) {
    return fail('Enter what you paid, greater than $0.00.');
  }
  if (
    input.taxPaidCents !== undefined &&
    (!Number.isInteger(input.taxPaidCents) ||
      input.taxPaidCents < 0 ||
      input.taxPaidCents > input.costCents)
  ) {
    return fail('Tax paid must be between $0.00 and the total cost.');
  }
  if (daysBetween(today, input.expiryDate) < 0) {
    return fail('That expiry date has already passed.');
  }
  const ing = findIngredient(state, input.ingredientId);
  const status = ingredientStatus(ing, today);

  // Simplified model: one active expiry date per ingredient. Expired stock is
  // set aside; otherwise combined stock keeps the earlier expiry date.
  let expiredQuantity = ing.expiredQuantity;
  let existing = ing.quantity;
  let expiry = input.expiryDate;
  if (existing > 0 && status.daysLeft !== null && status.daysLeft < 0) {
    expiredQuantity += existing;
    existing = 0;
  } else if (existing > 0 && ing.expiryDate && ing.expiryDate < expiry) {
    expiry = ing.expiryDate;
  }
  const newQty = roundQty(existing + input.quantity);
  const costPerUnitCents =
    (existing * ing.costPerUnitCents + input.costCents) / newQty;

  const supplier = input.supplierName.trim() || 'Supplier';
  return ok({
    ...state,
    ingredients: state.ingredients.map(i =>
      i.id === ing.id
        ? {
            ...i,
            quantity: newQty,
            expiryDate: expiry,
            expiredQuantity,
            costPerUnitCents,
          }
        : i,
    ),
    expenses: [
      ...state.expenses,
      {
        id: makeId('exp'),
        dateTime: now.toISOString(),
        description: `${input.productName?.trim() || ing.name} — ${supplier}`,
        amountCents: input.costCents,
        payment: input.payment,
        category: 'Ingredients',
        supplierName: supplier,
        ingredientId: ing.id,
        ...(input.taxPaidCents !== undefined
          ? { taxPaidCents: input.taxPaidCents }
          : {}),
      },
    ],
  });
}

export interface IngredientWasteInput {
  ingredientId: string;
  quantity: number;
  reason: string;
  /** Waste from set-aside expired stock rather than usable stock. */
  fromExpired: boolean;
  now?: Date;
}

export function wasteIngredient(
  state: AppState,
  input: IngredientWasteInput,
): Result {
  const now = input.now ?? new Date();
  const ing = findIngredient(state, input.ingredientId);
  const status = ingredientStatus(ing, todayKey(now));
  const limit = input.fromExpired ? status.expired : status.usable;
  if (!(input.quantity > 0)) {
    return fail('Enter a quantity greater than zero.');
  }
  if (input.quantity > limit + 1e-9) {
    return fail(
      `Only ${roundQty(limit)} ${ing.unit} ${
        input.fromExpired ? 'expired' : 'usable'
      } stock is on hand.`,
    );
  }
  let quantity = ing.quantity;
  let expiredQuantity = ing.expiredQuantity;
  let remaining = input.quantity;
  if (input.fromExpired) {
    const fromSetAside = Math.min(expiredQuantity, remaining);
    expiredQuantity = roundQty(expiredQuantity - fromSetAside);
    remaining -= fromSetAside;
  }
  quantity = roundQty(Math.max(0, quantity - remaining));
  return ok({
    ...state,
    ingredients: state.ingredients.map(i =>
      i.id === ing.id
        ? {
            ...i,
            quantity,
            expiredQuantity,
            expiryDate: quantity > 0 ? i.expiryDate : null,
          }
        : i,
    ),
    ingredientWaste: [
      ...state.ingredientWaste,
      {
        id: makeId('iw'),
        ingredientId: ing.id,
        quantity: input.quantity,
        reason: input.reason.trim() || 'Other',
        dateTime: now.toISOString(),
      },
    ],
  });
}

export function makeBatch(
  state: AppState,
  treatId: string,
  servings: number,
  now: Date = new Date(),
): Result {
  if (!Number.isInteger(servings) || servings <= 0) {
    return fail('Choose at least one serving.');
  }
  const reqs = batchRequirements(state, treatId, servings, todayKey(now));
  const short = reqs.filter(r => r.missing > 1e-9);
  if (short.length > 0) {
    return fail(
      `Not enough ${short
        .map(r => r.ingredient.name.toLowerCase())
        .join(', ')} to make this batch.`,
    );
  }
  const cost = estimateBatchCost(state, treatId, servings);
  const needed = new Map(reqs.map(r => [r.ingredient.id, r.needed]));
  return ok({
    ...state,
    ingredients: state.ingredients.map(i => {
      const n = needed.get(i.id);
      if (n === undefined) {
        return i;
      }
      const quantity = roundQty(Math.max(0, i.quantity - n));
      return { ...i, quantity, expiryDate: quantity > 0 ? i.expiryDate : null };
    }),
    batches: [
      ...state.batches,
      {
        id: makeId('batch'),
        treatId,
        servings,
        dateTime: now.toISOString(),
        ingredientCostCents: cost.ingredientCents,
        packagingCostCents: cost.packagingCents,
        totalCostCents: cost.totalCents,
      },
    ],
  });
}

/**
 * Fictional placeholder details for the demo verification record. A real
 * rebate sale needs the purchaser and documentation records Ontario requires
 * (see src/logic/tax.ts); ticking the confirmations alone is not enough.
 */
export const DEMO_RELIEF_DOCUMENT = {
  purchaserName: 'Demo Purchaser (fictional)',
  documentType: 'Status document — DEMO ONLY',
  documentReference: 'DEMO-0000000000',
};

export function allConfirmed(c: ReliefConfirmation | null | undefined): boolean {
  return (
    !!c &&
    c.eligibleIncludingResidency &&
    c.documentInspectedInPerson &&
    c.purchaseQualifies
  );
}

/** Tax for one treat line, using the shared Ontario calculation. */
export function previewSaleTax(
  state: AppState,
  treatId: string,
  quantity: number,
  fulfilment: Fulfilment,
  firstNationsVerified: boolean,
): TaxResult {
  const treat = findTreat(state, treatId);
  return calculateTax({
    lines: [
      {
        label: treat.name,
        unitPriceCents: treat.priceCents,
        quantity,
        ...treat.tax,
      },
    ],
    fulfilment,
    firstNationsVerified,
  });
}

export interface SaleInput {
  treatId: string;
  quantity: number;
  payment: SalePayment;
  fulfilment: Fulfilment;
  /** Completed First Nations relief confirmation, if staff verified one. */
  firstNationsRelief?: ReliefConfirmation | null;
  now?: Date;
}

export function sellTreat(state: AppState, input: SaleInput): Result {
  const now = input.now ?? new Date();
  const { treatId, quantity } = input;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return fail('Choose at least one treat.');
  }
  if (input.firstNationsRelief && !allConfirmed(input.firstNationsRelief)) {
    return fail('All First Nations relief confirmations are required.');
  }
  const treat = findTreat(state, treatId);
  const stock = finishedStock(state, treatId);
  if (quantity > stock) {
    return fail(
      stock === 0
        ? `No ${treat.name} servings left. Record a batch first.`
        : `Only ${stock} ${treat.name} servings are ready to sell.`,
    );
  }
  const tax = previewSaleTax(
    state,
    treatId,
    quantity,
    input.fulfilment,
    allConfirmed(input.firstNationsRelief),
  );
  if (!tax.ok) {
    return fail(tax.error);
  }
  const b = tax.breakdown;
  const saleId = makeId('sale');
  const relief =
    b.firstNationsRebateCents > 0 && input.firstNationsRelief
      ? {
          id: makeId('relief'),
          saleId,
          recordedAt: now.toISOString(),
          demo: true as const,
          ...DEMO_RELIEF_DOCUMENT,
          confirmations: { ...input.firstNationsRelief },
        }
      : null;
  return ok({
    ...state,
    sales: [
      ...state.sales,
      {
        id: saleId,
        treatId,
        quantity,
        unitPriceCents: treat.priceCents,
        subtotalCents: b.subtotalCents,
        taxBeforeRebatesCents: b.taxBeforeRebatesCents,
        preparedFoodRebateCents: b.preparedFoodRebateCents,
        firstNationsRebateCents: b.firstNationsRebateCents,
        taxChargedCents: b.taxChargedCents,
        totalCents: b.totalCents,
        taxRule: b.rule,
        taxRulesVersion: b.rulesVersion,
        fulfilment: input.fulfilment,
        reliefRecordId: relief?.id,
        payment: input.payment,
        dateTime: now.toISOString(),
      },
    ],
    reliefRecords: relief
      ? [...state.reliefRecords, relief]
      : state.reliefRecords,
  });
}

export function wasteTreat(
  state: AppState,
  treatId: string,
  quantity: number,
  reason: string,
  now: Date = new Date(),
): Result {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return fail('Choose at least one serving.');
  }
  const treat = findTreat(state, treatId);
  const stock = finishedStock(state, treatId);
  if (quantity > stock) {
    return fail(`Only ${stock} ${treat.name} servings are on hand.`);
  }
  return ok({
    ...state,
    treatWaste: [
      ...state.treatWaste,
      {
        id: makeId('tw'),
        treatId,
        quantity,
        reason: reason.trim() || 'Unsold',
        dateTime: now.toISOString(),
      },
    ],
  });
}

/** Sets or clears (null) a treat's standard batch size. */
export function setBatchSize(
  state: AppState,
  treatId: string,
  size: number | null,
): Result {
  if (size !== null && (!Number.isInteger(size) || size < 1 || size > 500)) {
    return fail('Batch size must be a whole number from 1 to 500.');
  }
  findTreat(state, treatId);
  return ok({
    ...state,
    treats: state.treats.map(t =>
      t.id === treatId ? { ...t, batchSize: size ?? undefined } : t,
    ),
  });
}

export function computeClosing(
  state: AppState,
  day: string,
  openingFloatCents: number,
  actualCashCents: number,
  terminalCardCents: number,
  now: Date = new Date(),
): Closing {
  const totals = dayTotals(state, day);
  const expectedDrawerCents =
    openingFloatCents + totals.cashSalesCents - totals.cashExpensesCents;
  const cashDiffCents = actualCashCents - expectedDrawerCents;
  const cardDiffCents = terminalCardCents - totals.cardSalesCents;
  return {
    date: day,
    openingFloatCents,
    cashSalesCents: totals.cashSalesCents,
    cardSalesCents: totals.cardSalesCents,
    cashExpensesCents: totals.cashExpensesCents,
    expectedDrawerCents,
    actualCashCents,
    terminalCardCents,
    cashDiffCents,
    cardDiffCents,
    // Integer cents: "within one cent" means a difference of at most 1.
    status:
      Math.abs(cashDiffCents) <= 1 && Math.abs(cardDiffCents) <= 1
        ? 'matched'
        : 'needs_review',
    closedAt: now.toISOString(),
  };
}

export function closeDay(state: AppState, closing: Closing): Result {
  if (
    closing.openingFloatCents < 0 ||
    closing.actualCashCents < 0 ||
    closing.terminalCardCents < 0
  ) {
    return fail('Amounts cannot be negative.');
  }
  return ok({
    ...state,
    closings: [
      ...state.closings.filter(c => c.date !== closing.date),
      closing,
    ],
  });
}
