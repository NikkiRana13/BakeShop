/**
 * Core data model for Grandma's Order Desk.
 * All money values are integer cents. Ingredient quantities use one base
 * unit per ingredient: grams (g), millilitres (mL) or individual units.
 */

import { Fulfilment, TaxProfile } from './logic/tax';

export type BaseUnit = 'g' | 'mL' | 'unit';
export type PackageUnit = BaseUnit | 'kg' | 'L';
export type SalePayment = 'cash' | 'card';
export type ExpensePayment = 'cash' | 'card' | 'unpaid';

export interface Ingredient {
  id: string;
  name: string;
  /** True when the name reads as plural ("apples expire" vs "cream expires"). */
  plural: boolean;
  unit: BaseUnit;
  /** Quantity carrying the active expiry date. */
  quantity: number;
  /** Local date key (YYYY-MM-DD) of the active stock, or null when empty. */
  expiryDate: string | null;
  /** Stock set aside because it expired before new stock arrived. */
  expiredQuantity: number;
  lowStockThreshold: number;
  /** Average cost per base unit, in cents (a rate; totals are rounded to cents). */
  costPerUnitCents: number;
  /** Typical shelf life, used to suggest an expiry date for new stock. */
  shelfLifeDays: number;
}

export interface RecipeLine {
  ingredientId: string;
  /** Quantity per serving in the ingredient's base unit. */
  quantity: number;
}

export interface Treat {
  id: string;
  name: string;
  priceCents: number;
  packagingCostCents: number;
  recipe: RecipeLine[];
  /** Explicit tax settings; never inferred from the name. */
  tax: TaxProfile;
}

export interface ProductionBatch {
  id: string;
  treatId: string;
  servings: number;
  dateTime: string;
  /** Cost snapshots taken when the batch was made. */
  ingredientCostCents: number;
  packagingCostCents: number;
  totalCostCents: number;
}

/**
 * A sale and the tax breakdown calculated when it was made. Stored values are
 * never recalculated, so later setting changes do not alter history.
 */
export interface Sale {
  id: string;
  treatId: string;
  quantity: number;
  unitPriceCents: number;
  /** Price before tax: this is the sales revenue. */
  subtotalCents: number;
  taxBeforeRebatesCents: number;
  preparedFoodRebateCents: number;
  firstNationsRebateCents: number;
  taxChargedCents: number;
  /** What the customer paid, including tax. */
  totalCents: number;
  taxRule: string;
  taxRulesVersion: string;
  fulfilment: Fulfilment;
  /** Links to the verification record when First Nations relief applied. */
  reliefRecordId?: string;
  payment: SalePayment;
  dateTime: string;
}

export interface ReliefConfirmation {
  eligibleIncludingResidency: boolean;
  documentInspectedInPerson: boolean;
  purchaseQualifies: boolean;
}

/**
 * Verification record kept with a First Nations rebate sale. In this demo the
 * purchaser and document details are fictional placeholders; real use needs
 * the records Ontario requires. Never shown in analytics, ledgers or logs.
 */
export interface ReliefRecord {
  id: string;
  saleId: string;
  recordedAt: string;
  demo: true;
  purchaserName: string;
  documentType: string;
  documentReference: string;
  confirmations: ReliefConfirmation;
}

export interface TreatWaste {
  id: string;
  treatId: string;
  quantity: number;
  reason: string;
  dateTime: string;
}

export interface IngredientWaste {
  id: string;
  ingredientId: string;
  quantity: number;
  reason: string;
  dateTime: string;
}

export interface Expense {
  id: string;
  dateTime: string;
  description: string;
  amountCents: number;
  payment: ExpensePayment;
  category: 'Ingredients';
  supplierName: string;
  ingredientId?: string;
  /** Tax shown on the supplier receipt, only when explicitly recorded. */
  taxPaidCents?: number;
}

export interface Supplier {
  id: string;
  name: string;
  isLocal: boolean;
  /** 0 means in-store pickup with no delivery fee. */
  deliveryFeeCents: number;
}

export interface SupplierOffer {
  id: string;
  supplierId: string;
  ingredientId: string;
  productName: string;
  packageSize: number;
  packageUnit: PackageUnit;
  priceCents: number;
  inStock: boolean;
  leadTimeDays: number;
}

export interface Closing {
  date: string;
  openingFloatCents: number;
  cashSalesCents: number;
  cardSalesCents: number;
  cashExpensesCents: number;
  expectedDrawerCents: number;
  actualCashCents: number;
  terminalCardCents: number;
  cashDiffCents: number;
  cardDiffCents: number;
  status: 'matched' | 'needs_review';
  closedAt: string;
}

export interface AppState {
  version: number;
  ingredients: Ingredient[];
  treats: Treat[];
  suppliers: Supplier[];
  offers: SupplierOffer[];
  batches: ProductionBatch[];
  sales: Sale[];
  treatWaste: TreatWaste[];
  ingredientWaste: IngredientWaste[];
  expenses: Expense[];
  closings: Closing[];
  reliefRecords: ReliefRecord[];
}

export type Result = { ok: true; state: AppState } | { ok: false; error: string };
