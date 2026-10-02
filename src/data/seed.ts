/**
 * Demo data, generated relative to the current local date on first launch.
 * Supplier names, products and prices are fictional demo data.
 */
import { computeClosing, DEMO_RELIEF_DOCUMENT } from '../logic/actions';
import { calculateTax, Fulfilment, TaxProfile } from '../logic/tax';
import {
  AppState,
  Ingredient,
  ReliefRecord,
  ProductionBatch,
  Sale,
  SalePayment,
  Supplier,
  SupplierOffer,
  Treat,
  TreatWaste,
} from '../types';
import { addDays, startOfDay, todayKey } from '../utils/format';

// Bumped when the saved shape changes; older saved data is replaced by a fresh seed.
export const STATE_VERSION = 2;
export const DEFAULT_FLOAT_CENTS = 10000;

const ingredients = (today: string): Ingredient[] => [
  {
    id: 'apples',
    name: 'Apples',
    plural: true,
    unit: 'g',
    quantity: 1500,
    expiryDate: addDays(today, 6),
    expiredQuantity: 0,
    lowStockThreshold: 600,
    costPerUnitCents: 0.4,
    shelfLifeDays: 14,
  },
  {
    id: 'cream',
    name: 'Cream',
    plural: false,
    unit: 'mL',
    quantity: 300,
    expiryDate: addDays(today, 9),
    expiredQuantity: 0,
    lowStockThreshold: 1000,
    costPerUnitCents: 0.45,
    shelfLifeDays: 10,
  },
  {
    id: 'yogurt',
    name: 'Yogurt',
    plural: false,
    unit: 'g',
    quantity: 3000,
    expiryDate: addDays(today, 12),
    expiredQuantity: 0,
    lowStockThreshold: 1000,
    costPerUnitCents: 0.46,
    shelfLifeDays: 14,
  },
  {
    id: 'granola',
    name: 'Granola',
    plural: false,
    unit: 'g',
    quantity: 1500,
    expiryDate: addDays(today, 60),
    expiredQuantity: 0,
    lowStockThreshold: 400,
    costPerUnitCents: 1.1,
    shelfLifeDays: 90,
  },
  {
    id: 'chocolate',
    name: 'Chocolate',
    plural: false,
    unit: 'g',
    quantity: 800,
    expiryDate: addDays(today, 120),
    expiredQuantity: 0,
    lowStockThreshold: 200,
    costPerUnitCents: 2.1,
    shelfLifeDays: 180,
  },
  {
    id: 'pumpkin',
    name: 'Pumpkin purée',
    plural: false,
    unit: 'g',
    quantity: 900,
    expiryDate: addDays(today, 14),
    expiredQuantity: 0,
    lowStockThreshold: 300,
    costPerUnitCents: 0.38,
    shelfLifeDays: 7,
  },
];

/**
 * Demo tax configuration for individual takeaway parfaits sold one serving
 * at a time: taxable at 13%, counted toward the $4 prepared-food rebate, and
 * eligible for the First Nations point-of-sale rebate. Set explicitly for the
 * demo; confirm real classifications with an accountant. A product whose
 * treatment is unclear should use taxClass 'needs_review' until checked.
 */
const PARFAIT_TAX: TaxProfile = {
  taxClass: 'standard',
  preparedFoodRebateEligible: true,
  firstNationsRebateEligible: true,
};

const treats: Treat[] = [
  {
    id: 'apple',
    name: 'Apple Crumble Parfait',
    priceCents: 650,
    packagingCostCents: 35,
    tax: PARFAIT_TAX,
    recipe: [
      { ingredientId: 'apples', quantity: 80 },
      { ingredientId: 'cream', quantity: 50 },
      { ingredientId: 'yogurt', quantity: 100 },
      { ingredientId: 'granola', quantity: 30 },
    ],
  },
  {
    id: 'chocolate',
    name: 'Chocolate Parfait',
    priceCents: 700,
    packagingCostCents: 35,
    tax: PARFAIT_TAX,
    recipe: [
      { ingredientId: 'chocolate', quantity: 30 },
      { ingredientId: 'cream', quantity: 60 },
      { ingredientId: 'yogurt', quantity: 100 },
      { ingredientId: 'granola', quantity: 25 },
    ],
  },
  {
    id: 'pumpkin',
    name: 'Pumpkin Parfait',
    priceCents: 675,
    packagingCostCents: 35,
    tax: PARFAIT_TAX,
    recipe: [
      { ingredientId: 'pumpkin', quantity: 70 },
      { ingredientId: 'cream', quantity: 40 },
      { ingredientId: 'yogurt', quantity: 100 },
      { ingredientId: 'granola', quantity: 30 },
    ],
  },
];

const suppliers: Supplier[] = [
  { id: 'maple', name: 'Maple Street Grocer', isLocal: true, deliveryFeeCents: 0 },
  {
    id: 'valley',
    name: 'Valley Wholesale Foods',
    isLocal: false,
    deliveryFeeCents: 600,
  },
  { id: 'farm', name: 'Corner Farm Market', isLocal: true, deliveryFeeCents: 0 },
];

type OfferRow = [string, string, string, number, SupplierOffer['packageUnit'], number, boolean, number];
// supplier, ingredient, product, size, unit, price (cents), in stock, lead days
const offerRows: OfferRow[] = [
  ['maple', 'apples', 'Gala apples, 1.5 kg bag', 1.5, 'kg', 649, true, 0],
  ['valley', 'apples', 'Apples, 3 kg case', 3, 'kg', 980, true, 1],
  ['farm', 'apples', 'McIntosh apples, 2 kg basket', 2, 'kg', 750, true, 0],
  ['maple', 'cream', 'Whipping cream 35%, 473 mL', 473, 'mL', 479, true, 0],
  ['valley', 'cream', 'Whipping cream 35%, 1 L carton', 1, 'L', 450, true, 0],
  ['farm', 'cream', 'Farm cream, 500 mL jar', 500, 'mL', 525, true, 0],
  ['maple', 'yogurt', 'Plain yogurt, 750 g tub', 750, 'g', 349, true, 0],
  ['valley', 'yogurt', 'Plain yogurt, 2 kg tub', 2, 'kg', 720, true, 1],
  ['farm', 'yogurt', 'Farm yogurt, 1 kg', 1, 'kg', 500, false, 0],
  ['maple', 'granola', 'Granola, 500 g', 500, 'g', 549, true, 0],
  ['valley', 'granola', 'Bulk granola, 2 kg', 2, 'kg', 1600, true, 2],
  ['farm', 'granola', 'Honey oat granola, 400 g', 400, 'g', 475, true, 0],
  ['maple', 'chocolate', 'Dark chocolate bar, 200 g', 200, 'g', 429, true, 0],
  ['valley', 'chocolate', 'Chocolate callets, 1 kg', 1, 'kg', 1850, true, 1],
  ['maple', 'pumpkin', 'Pumpkin purée, 796 g can', 796, 'g', 299, true, 0],
  ['valley', 'pumpkin', 'Pumpkin purée, 6 × 796 g case', 4776, 'g', 1500, true, 2],
  ['farm', 'pumpkin', 'Fresh pumpkin purée, 1 kg', 1, 'kg', 600, true, 0],
];

const offers: SupplierOffer[] = offerRows.map(
  ([supplierId, ingredientId, productName, packageSize, packageUnit, priceCents, inStock, leadTimeDays]) => ({
    id: `${supplierId}-${ingredientId}`,
    supplierId,
    ingredientId,
    productName,
    packageSize,
    packageUnit,
    priceCents,
    inStock,
    leadTimeDays,
  }),
);

/** Per day, oldest first (6 days ago … today): [produced, sold, wasted]. */
const HISTORY: Record<string, [number, number, number][]> = {
  apple: [
    [12, 11, 1],
    [12, 12, 0],
    [12, 10, 2],
    [12, 12, 0],
    [12, 11, 1],
    [12, 12, 0],
    [12, 5, 0],
  ],
  chocolate: [
    [10, 8, 2],
    [10, 7, 3],
    [10, 9, 1],
    [10, 8, 2],
    [10, 6, 4],
    [10, 9, 1],
    [8, 3, 0],
  ],
  pumpkin: [
    [10, 5, 5],
    [10, 4, 6],
    [8, 5, 3],
    [8, 4, 4],
    [8, 6, 2],
    [8, 5, 3],
    [6, 2, 0],
  ],
};

const PAYMENT_PATTERN: SalePayment[] = ['card', 'cash', 'card', 'card', 'cash'];

export function createSeedState(now: Date = new Date()): AppState {
  const today = todayKey(now);
  const ings = ingredients(today);
  const rate = new Map(ings.map(i => [i.id, i.costPerUnitCents]));
  const batches: ProductionBatch[] = [];
  const sales: Sale[] = [];
  const treatWaste: TreatWaste[] = [];
  const reliefRecords: ReliefRecord[] = [];
  let seq = 0;
  let payIdx = 0;

  // Today's seeded events sit in the few hours before "now".
  const todayStart = startOfDay(today).getTime();
  const todayBase = Math.max(todayStart + 60_000, now.getTime() - 4 * 3600_000);
  const at = (day: string, hours: number) =>
    startOfDay(day).getTime() + hours * 3600_000;

  for (let d = 0; d < 7; d++) {
    const daysAgo = 6 - d;
    const day = addDays(today, -daysAgo);
    const isToday = daysAgo === 0;
    // Prices were a little lower earlier in the week; batch snapshots keep that.
    const priceFactor = daysAgo >= 4 ? 0.95 : 1;
    for (const treat of treats) {
      const [produced, sold, wasted] = HISTORY[treat.id][d];
      const prodTime = isToday ? todayBase : at(day, 7.5);
      let ingredientCost = 0;
      for (const line of treat.recipe) {
        ingredientCost +=
          line.quantity * produced * (rate.get(line.ingredientId) ?? 0) * priceFactor;
      }
      const ingredientCostCents = Math.round(ingredientCost);
      const packagingCostCents = treat.packagingCostCents * produced;
      batches.push({
        id: `seed-batch-${seq++}`,
        treatId: treat.id,
        servings: produced,
        dateTime: new Date(prodTime).toISOString(),
        ingredientCostCents,
        packagingCostCents,
        totalCostCents: ingredientCostCents + packagingCostCents,
      });

      let left = sold;
      let i = 0;
      while (left > 0) {
        const qty = Math.min(left, i % 3 === 0 ? 2 : 1);
        left -= qty;
        i += 1;
        const time = isToday
          ? Math.max(prodTime, Math.min(todayBase + i * 12 * 60_000, now.getTime()))
          : at(day, 9) + i * 37 * 60_000;
        // A few seeded sales show dine-in and verified First Nations relief.
        const saleNo = sales.length;
        const fulfilment: Fulfilment = saleNo % 9 === 4 ? 'dine_in' : 'takeaway';
        const withRelief =
          treat.id === 'apple' && i === 1 && (daysAgo === 2 || daysAgo === 4);
        const tax = calculateTax({
          lines: [
            {
              label: treat.name,
              unitPriceCents: treat.priceCents,
              quantity: qty,
              ...treat.tax,
            },
          ],
          fulfilment: withRelief ? 'takeaway' : fulfilment,
          firstNationsVerified: withRelief,
        });
        if (!tax.ok) {
          throw new Error(tax.error);
        }
        const b = tax.breakdown;
        const saleId = `seed-sale-${seq++}`;
        const dateTime = new Date(time).toISOString();
        if (withRelief) {
          reliefRecords.push({
            id: `seed-relief-${seq++}`,
            saleId,
            recordedAt: dateTime,
            demo: true,
            ...DEMO_RELIEF_DOCUMENT,
            confirmations: {
              eligibleIncludingResidency: true,
              documentInspectedInPerson: true,
              purchaseQualifies: true,
            },
          });
        }
        sales.push({
          id: saleId,
          treatId: treat.id,
          quantity: qty,
          unitPriceCents: treat.priceCents,
          subtotalCents: b.subtotalCents,
          taxBeforeRebatesCents: b.taxBeforeRebatesCents,
          preparedFoodRebateCents: b.preparedFoodRebateCents,
          firstNationsRebateCents: b.firstNationsRebateCents,
          taxChargedCents: b.taxChargedCents,
          totalCents: b.totalCents,
          taxRule: b.rule,
          taxRulesVersion: b.rulesVersion,
          fulfilment: withRelief ? 'takeaway' : fulfilment,
          reliefRecordId: withRelief
            ? reliefRecords[reliefRecords.length - 1].id
            : undefined,
          payment: PAYMENT_PATTERN[payIdx++ % PAYMENT_PATTERN.length],
          dateTime,
        });
      }
      if (wasted > 0) {
        treatWaste.push({
          id: `seed-waste-${seq++}`,
          treatId: treat.id,
          quantity: wasted,
          reason: 'Unsold at closing',
          dateTime: new Date(at(day, 18)).toISOString(),
        });
      }
    }
  }

  const expenseAt = (daysAgo: number) =>
    new Date(
      daysAgo === 0 ? todayBase - 30 * 60_000 : at(addDays(today, -daysAgo), 8),
    ).toISOString();
  const state: AppState = {
    version: STATE_VERSION,
    ingredients: ings,
    treats,
    suppliers,
    offers,
    batches,
    sales,
    treatWaste,
    ingredientWaste: [
      {
        id: 'seed-iw-0',
        ingredientId: 'yogurt',
        quantity: 200,
        reason: 'Spoiled',
        dateTime: new Date(at(addDays(today, -3), 17)).toISOString(),
      },
    ],
    expenses: [
      {
        id: 'seed-exp-0',
        dateTime: expenseAt(6),
        description: 'Plain yogurt, 2 kg tub ×2 — Valley Wholesale Foods',
        amountCents: 1440,
        payment: 'card',
        category: 'Ingredients',
        supplierName: 'Valley Wholesale Foods',
        ingredientId: 'yogurt',
      },
      {
        id: 'seed-exp-1',
        dateTime: expenseAt(4),
        description: 'Gala apples, 1.5 kg bag — Maple Street Grocer',
        amountCents: 649,
        payment: 'cash',
        category: 'Ingredients',
        supplierName: 'Maple Street Grocer',
        ingredientId: 'apples',
      },
      {
        id: 'seed-exp-2',
        dateTime: expenseAt(3),
        description: 'Fresh pumpkin purée, 1 kg — Corner Farm Market',
        amountCents: 600,
        payment: 'unpaid',
        category: 'Ingredients',
        supplierName: 'Corner Farm Market',
        ingredientId: 'pumpkin',
      },
      {
        id: 'seed-exp-3',
        dateTime: expenseAt(1),
        description: 'Whipping cream 35%, 473 mL — Maple Street Grocer',
        amountCents: 479,
        payment: 'cash',
        category: 'Ingredients',
        supplierName: 'Maple Street Grocer',
        ingredientId: 'cream',
      },
      {
        id: 'seed-exp-4',
        dateTime: expenseAt(0),
        description: 'Honey oat granola, 400 g ×2 — Corner Farm Market',
        amountCents: 950,
        // Explicitly recorded from the (demo) receipt.
        taxPaidCents: 0,
        payment: 'card',
        category: 'Ingredients',
        supplierName: 'Corner Farm Market',
        ingredientId: 'granola',
      },
    ],
    closings: [],
    reliefRecords,
  };

  // Past days closed: matched, except yesterday's sample cash discrepancy.
  for (let daysAgo = 6; daysAgo >= 1; daysAgo--) {
    const day = addDays(today, -daysAgo);
    const probe = computeClosing(state, day, DEFAULT_FLOAT_CENTS, 0, 0, now);
    const shortCents = daysAgo === 1 ? 500 : 0;
    state.closings.push(
      computeClosing(
        state,
        day,
        DEFAULT_FLOAT_CENTS,
        probe.expectedDrawerCents - shortCents,
        probe.cardSalesCents,
        new Date(at(day, 18.5)),
      ),
    );
  }
  return state;
}
