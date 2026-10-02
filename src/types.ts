/**
 * Core data model for Grandma's Order Desk.
 * All money values are integer cents. Ingredient quantities use one base
 * unit per ingredient: grams (g), millilitres (mL) or individual units.
 */

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

export interface Sale {
  id: string;
  treatId: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  payment: SalePayment;
  dateTime: string;
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
}

export type Result = { ok: true; state: AppState } | { ok: false; error: string };
