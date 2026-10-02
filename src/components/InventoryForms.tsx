import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  addStock,
  makeBatch,
  wasteIngredient,
} from '../logic/actions';
import {
  batchRequirements,
  estimateBatchCost,
  finishedStock,
  ingredientStatus,
} from '../logic/selectors';
import { OfferOption, planShopping } from '../logic/shopping';
import { useStore } from '../state/store';
import { ExpensePayment } from '../types';
import {
  addDays,
  centsToInput,
  daysBetween,
  formatCents,
  formatDate,
  formatQty,
  parseDateKey,
  parseDollars,
  parseQuantity,
  relativeDays,
  roundQty,
  todayKey,
  unitLabel,
} from '../utils/format';
import {
  Badge,
  Body,
  Button,
  Card,
  Choices,
  Field,
  Notice,
  Row,
  Stat,
  Stepper,
} from './ui';
import { colors } from '../theme';

const formStyles = StyleSheet.create({
  reqRow: { gap: 4, paddingVertical: 4 },
  between: { justifyContent: 'space-between' },
  option: { gap: 6 },
  alternative: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
});

export interface StockPrefill {
  ingredientId: string;
  quantity?: number;
  costCents?: number;
  supplierName?: string;
  productName?: string;
}

// ---------------------------------------------------------------- Add stock

export function AddStockForm({
  prefill,
  onDone,
}: {
  prefill?: StockPrefill;
  onDone: (message: string) => void;
}) {
  const { state, run } = useStore();
  const today = todayKey();
  const firstId = prefill?.ingredientId ?? state.ingredients[0].id;
  const [ingredientId, setIngredientId] = useState(firstId);
  const ingredient = state.ingredients.find(i => i.id === ingredientId)!;
  const [qty, setQty] = useState(
    prefill?.quantity ? String(roundQty(prefill.quantity)) : '',
  );
  const [cost, setCost] = useState(
    prefill?.costCents ? centsToInput(prefill.costCents) : '',
  );
  const [expiry, setExpiry] = useState(
    addDays(today, ingredient.shelfLifeDays),
  );
  const [payment, setPayment] = useState<ExpensePayment>('card');
  const [supplier, setSupplier] = useState(prefill?.supplierName ?? '');
  const [taxPaid, setTaxPaid] = useState('');
  const [error, setError] = useState<string | null>(null);

  const status = ingredientStatus(ingredient, today);
  const expiryValid = parseDateKey(expiry) !== null;
  let combineNote: string | null = null;
  if (ingredient.quantity > 0 && ingredient.expiryDate) {
    if (status.daysLeft !== null && status.daysLeft < 0) {
      combineNote = `Your current ${formatQty(
        ingredient.quantity,
        ingredient.unit,
      )} is past its expiry date. It will be set aside as expired stock.`;
    } else if (expiryValid && ingredient.expiryDate < expiry) {
      combineNote = `You already have ${formatQty(
        ingredient.quantity,
        ingredient.unit,
      )} expiring ${formatDate(
        ingredient.expiryDate,
      )}. To keep things simple, the app tracks one expiry date per ingredient and keeps the earlier date for the combined stock.`;
    }
  }

  const submit = () => {
    const q = parseQuantity(qty);
    const c = parseDollars(cost);
    if (q === null || q <= 0) {
      return setError(`Enter the quantity received in ${unitLabel(ingredient.unit)}.`);
    }
    if (c === null || c <= 0) {
      return setError('Enter what you paid, for example 4.50.');
    }
    if (!expiryValid) {
      return setError('Enter the expiry date as YYYY-MM-DD.');
    }
    const t = taxPaid.trim() === '' ? undefined : parseDollars(taxPaid);
    if (t === null) {
      return setError('Enter the tax shown on the receipt, for example 0.59, or leave it blank.');
    }
    const err = run(s =>
      addStock(s, {
        ingredientId,
        quantity: q,
        costCents: c,
        expiryDate: expiry,
        payment,
        supplierName: supplier,
        productName: prefill?.productName,
        taxPaidCents: t,
      }),
    );
    if (err) {
      return setError(err);
    }
    onDone(
      `Added ${formatQty(q, ingredient.unit)} ${ingredient.name.toLowerCase()} and recorded a ${formatCents(
        c,
      )} ${payment === 'unpaid' ? 'unpaid' : payment} expense.`,
    );
  };

  return (
    <>
      {prefill?.productName ? (
        <Card tone="warm">
          <Body bold>Suggested: {prefill.productName}</Body>
          <Body muted>
            Check the quantity, price and expiry date on what you actually
            received before saving.
          </Body>
        </Card>
      ) : null}
      <Choices
        label="Ingredient"
        value={ingredientId}
        onChange={id => {
          setIngredientId(id);
          const ing = state.ingredients.find(i => i.id === id)!;
          setExpiry(addDays(today, ing.shelfLifeDays));
        }}
        options={state.ingredients.map(i => ({ value: i.id, label: i.name }))}
      />
      <Field
        label={`Quantity received (${unitLabel(ingredient.unit)})`}
        keyboardType="decimal-pad"
        value={qty}
        onChangeText={setQty}
        placeholder={ingredient.unit === 'mL' ? 'e.g. 1000' : 'e.g. 500'}
        hint={`On hand now: ${formatQty(status.usable, ingredient.unit)}`}
      />
      <Field
        label="Total cost paid ($)"
        keyboardType="decimal-pad"
        value={cost}
        onChangeText={setCost}
        placeholder="e.g. 4.50"
      />
      <Field
        label="Tax shown on the receipt ($, optional)"
        keyboardType="decimal-pad"
        value={taxPaid}
        onChangeText={setTaxPaid}
        placeholder="Leave blank if not shown"
        hint="Only what the receipt says. Many groceries have no tax."
      />
      <Field
        label="Expiry date (YYYY-MM-DD)"
        value={expiry}
        onChangeText={setExpiry}
        autoCapitalize="none"
        hint={
          expiryValid
            ? `${formatDate(expiry)} · ${relativeDays(daysBetween(today, expiry))}`
            : 'Example: ' + addDays(today, 7)
        }
      />
      {combineNote ? (
        <Card tone="warn">
          <Body>{combineNote}</Body>
        </Card>
      ) : null}
      <Field
        label="Supplier"
        value={supplier}
        onChangeText={setSupplier}
        placeholder="e.g. Maple Street Grocer"
      />
      <Choices
        label="How was it paid?"
        value={payment}
        onChange={setPayment}
        options={[
          { value: 'cash', label: 'Cash' },
          { value: 'card', label: 'Card' },
          { value: 'unpaid', label: 'Unpaid', detail: 'Owe supplier' },
        ]}
      />
      <Notice text={error} />
      <Button label="Save received stock" icon="＋" onPress={submit} />
    </>
  );
}

// ------------------------------------------------------- Ingredient waste

export function IngredientWasteForm({
  initialIngredientId,
  initialExpired,
  onDone,
}: {
  initialIngredientId?: string;
  initialExpired?: boolean;
  onDone: (message: string) => void;
}) {
  const { state, run } = useStore();
  const today = todayKey();
  const [ingredientId, setIngredientId] = useState(
    initialIngredientId ?? state.ingredients[0].id,
  );
  const ingredient = state.ingredients.find(i => i.id === ingredientId)!;
  const status = ingredientStatus(ingredient, today);
  const [source, setSource] = useState<'usable' | 'expired'>(
    initialExpired ? 'expired' : 'usable',
  );
  const fromExpired = source === 'expired' && status.expired > 0;
  const limit = fromExpired ? status.expired : status.usable;
  const [qty, setQty] = useState(
    initialExpired && status.expired > 0 ? String(roundQty(status.expired)) : '',
  );
  const [reason, setReason] = useState(initialExpired ? 'Expired' : 'Spoiled');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const q = parseQuantity(qty);
    if (q === null || q <= 0) {
      return setError(`Enter the amount wasted in ${unitLabel(ingredient.unit)}.`);
    }
    const err = run(s =>
      wasteIngredient(s, {
        ingredientId,
        quantity: q,
        reason,
        fromExpired,
      }),
    );
    if (err) {
      return setError(err);
    }
    onDone(
      `Recorded ${formatQty(q, ingredient.unit)} ${ingredient.name.toLowerCase()} as waste (${reason.toLowerCase()}).`,
    );
  };

  return (
    <>
      <Choices
        label="Ingredient"
        value={ingredientId}
        onChange={id => {
          setIngredientId(id);
          setQty('');
          setError(null);
        }}
        options={state.ingredients.map(i => ({ value: i.id, label: i.name }))}
      />
      {status.expired > 0 ? (
        <Choices
          label="Which stock?"
          value={source}
          onChange={setSource}
          options={[
            {
              value: 'usable',
              label: 'Usable stock',
              detail: formatQty(status.usable, ingredient.unit),
            },
            {
              value: 'expired',
              label: 'Expired stock',
              detail: formatQty(status.expired, ingredient.unit),
            },
          ]}
        />
      ) : null}
      <Field
        label={`Amount wasted (${unitLabel(ingredient.unit)})`}
        keyboardType="decimal-pad"
        value={qty}
        onChangeText={setQty}
        hint={`Up to ${formatQty(limit, ingredient.unit)} available`}
      />
      <Choices
        label="Reason"
        value={reason}
        onChange={setReason}
        options={['Spoiled', 'Expired', 'Spilled or dropped', 'Other'].map(
          r => ({ value: r, label: r }),
        )}
      />
      <Notice text={error} />
      <Button
        label="Record waste"
        variant="danger"
        onPress={submit}
        disabled={limit <= 0}
      />
      {limit <= 0 ? <Body muted>There is no stock of this kind to waste.</Body> : null}
    </>
  );
}

// ------------------------------------------------------------------ Batch

function RequirementList({
  treatId,
  servings,
}: {
  treatId: string;
  servings: number;
}) {
  const { state } = useStore();
  const reqs = batchRequirements(state, treatId, servings);
  return (
    <Card>
      <Body bold>Ingredients needed</Body>
      {reqs.map(r => (
        <View key={r.ingredient.id} style={formStyles.reqRow}>
          <Row style={formStyles.between}>
            <Body bold>{r.ingredient.name}</Body>
            {r.missing > 0 ? (
              <Badge
                tone="bad"
                label={`Missing ${formatQty(r.missing, r.ingredient.unit)}`}
              />
            ) : (
              <Badge tone="good" label="Enough" />
            )}
          </Row>
          <Body muted>
            Need {formatQty(r.needed, r.ingredient.unit)} · Usable{' '}
            {formatQty(r.available, r.ingredient.unit)}
          </Body>
        </View>
      ))}
    </Card>
  );
}

export function BatchForm({
  initialTreatId,
  initialServings,
  onFindMissing,
  onDone,
}: {
  initialTreatId?: string;
  initialServings?: number;
  onFindMissing: (treatId: string, servings: number) => void;
  onDone: (message: string) => void;
}) {
  const { state, run } = useStore();
  const [treatId, setTreatId] = useState(initialTreatId ?? state.treats[0].id);
  const [servings, setServings] = useState(initialServings ?? 16);
  const [error, setError] = useState<string | null>(null);
  const treat = state.treats.find(t => t.id === treatId)!;
  const reqs = batchRequirements(state, treatId, servings);
  const short = reqs.some(r => r.missing > 0);
  const cost = estimateBatchCost(state, treatId, servings);

  const submit = () => {
    const err = run(s => makeBatch(s, treatId, servings));
    if (err) {
      return setError(err);
    }
    onDone(
      `Made ${servings} ${treat.name}. Ingredients deducted; ${finishedStock(
        state,
        treatId,
      ) + servings} servings now ready to sell.`,
    );
  };

  return (
    <>
      <Choices
        label="Treat"
        value={treatId}
        onChange={id => {
          setTreatId(id);
          setError(null);
        }}
        options={state.treats.map(t => ({
          value: t.id,
          label: t.name,
          detail: `${finishedStock(state, t.id)} ready`,
        }))}
      />
      <Stepper
        label="Servings to make"
        value={servings}
        onChange={n => {
          setServings(n);
          setError(null);
        }}
        max={200}
        suffix="servings"
      />
      <RequirementList treatId={treatId} servings={servings} />
      <Card>
        <Body bold>Estimated cost</Body>
        <Stat label="Ingredients" value={formatCents(cost.ingredientCents)} />
        <Stat label="Packaging" value={formatCents(cost.packagingCents)} />
        <Stat label="Total" value={formatCents(cost.totalCents)} strong />
        <Stat
          label="Per serving"
          value={formatCents(Math.round(cost.totalCents / servings))}
        />
      </Card>
      {short ? (
        <>
          <Notice text="Not enough usable stock for this batch. Buy the missing ingredients first or make fewer servings." />
          <Button
            label="Find missing ingredients"
            icon="🔍"
            variant="secondary"
            onPress={() => onFindMissing(treatId, servings)}
          />
        </>
      ) : null}
      <Notice text={error} />
      <Button
        label={`Make ${servings} servings`}
        icon="✓"
        onPress={submit}
        disabled={short}
        accessibilityHint="Deducts recipe ingredients and adds finished servings"
      />
    </>
  );
}

// -------------------------------------------------------- Shopping helper

const NEEDED_BY = [
  { days: 0, label: 'Today' },
  { days: 1, label: 'Tomorrow' },
  { days: 3, label: 'In 3 days' },
  { days: 7, label: 'In a week' },
];

function OptionCard({
  option,
  ingredientUnit,
  title,
  today,
  onAdd,
}: {
  option: OfferOption;
  ingredientUnit: 'g' | 'mL' | 'unit';
  title: string;
  today: string;
  onAdd: () => void;
}) {
  const { offer, supplier } = option;
  const arrival =
    offer.leadTimeDays === 0
      ? 'Available today'
      : `Arrives ${formatDate(option.availableDate)} (${relativeDays(
          daysBetween(today, option.availableDate),
        )})`;
  return (
    <View style={formStyles.option}>
      <Body muted>{title}</Body>
      <Body>
        Buy {option.packages} × {offer.productName} from{' '}
        <Body bold>{supplier.name}</Body> for{' '}
        <Body bold>{formatCents(option.totalCents)}</Body>.
      </Body>
      <Stat
        label="Package size"
        value={formatQty(option.baseSize, ingredientUnit)}
      />
      <Stat label="Packages" value={String(option.packages)} />
      <Stat label="Arrival" value={arrival} />
      <Body muted>
        {supplier.deliveryFeeCents > 0
          ? `Price does not include the ${formatCents(
              supplier.deliveryFeeCents,
            )} delivery fee.`
          : 'In-store pickup — no delivery fee.'}
      </Body>
      <Row>
        {option.reasons.map(r => (
          <Badge key={r} tone="info" label={r} icon="★" />
        ))}
      </Row>
      <Button label="Add received stock" variant="secondary" icon="＋" onPress={onAdd} />
    </View>
  );
}

export function ShoppingForm({
  initialTreatId,
  initialServings,
  onAddReceived,
  onMakeBatch,
}: {
  initialTreatId?: string;
  initialServings?: number;
  onAddReceived: (prefill: StockPrefill) => void;
  onMakeBatch: (treatId: string, servings: number) => void;
}) {
  const { state } = useStore();
  const today = todayKey();
  const [treatId, setTreatId] = useState(initialTreatId ?? state.treats[0].id);
  const [servings, setServings] = useState(initialServings ?? 16);
  const [neededIn, setNeededIn] = useState('0');
  const [customDate, setCustomDate] = useState(addDays(today, 14));
  const customValid =
    parseDateKey(customDate.trim()) !== null &&
    daysBetween(today, customDate.trim()) >= 0;
  const neededBy =
    neededIn === 'custom'
      ? customValid
        ? customDate.trim()
        : today
      : addDays(today, Number(neededIn));
  const plan = useMemo(
    () => planShopping(state, treatId, servings, neededBy, today),
    [state, treatId, servings, neededBy, today],
  );

  const toPrefill = (ingredientId: string, o: OfferOption): StockPrefill => ({
    ingredientId,
    quantity: o.packages * o.baseSize,
    costCents: o.totalCents,
    supplierName: o.supplier.name,
    productName: `${o.offer.productName}${o.packages > 1 ? ` ×${o.packages}` : ''}`,
  });

  return (
    <>
      <Card tone="warn">
        <Body bold>Demo supplier data</Body>
        <Body muted>
          Suppliers and prices are fictional sample data, not live prices.
          Each ingredient is recommended on its own; this is not a combined
          shopping trip, and nothing is ordered automatically.
        </Body>
      </Card>
      <Choices
        label="Treat"
        value={treatId}
        onChange={setTreatId}
        options={state.treats.map(t => ({ value: t.id, label: t.name }))}
      />
      <Stepper
        label="Servings planned"
        value={servings}
        onChange={setServings}
        max={200}
        suffix="servings"
      />
      <Choices
        label="Needed by"
        value={neededIn}
        onChange={setNeededIn}
        options={[
          ...NEEDED_BY.map(n => ({
            value: String(n.days),
            label: n.label,
            detail: formatDate(addDays(today, n.days)),
          })),
          { value: 'custom', label: 'Custom date' },
        ]}
      />
      {neededIn === 'custom' ? (
        <Field
          label="Needed by (YYYY-MM-DD)"
          value={customDate}
          onChangeText={setCustomDate}
          autoCapitalize="none"
          hint={customValid ? formatDate(customDate.trim()) : undefined}
          error={
            customValid
              ? null
              : 'Enter a date from today onward, e.g. ' + addDays(today, 14) +
                '. Showing options for today until then.'
          }
        />
      ) : null}
      {plan.everythingOnHand ? (
        <Card tone="good">
          <Body bold>✓ You have everything you need.</Body>
          <Body muted>
            Usable stock covers {servings} servings of{' '}
            {state.treats.find(t => t.id === treatId)?.name}.
          </Body>
          <Button
            label="Record this batch"
            onPress={() => onMakeBatch(treatId, servings)}
          />
        </Card>
      ) : (
        plan.lines.map(line => (
          <Card key={line.ingredient.id}>
            <Row style={formStyles.between}>
              <Body bold>{line.ingredient.name}</Body>
              <Badge
                tone="bad"
                label={`Missing ${formatQty(line.missing, line.ingredient.unit)}`}
              />
            </Row>
            {line.best ? (
              <>
                <OptionCard
                  option={line.best}
                  ingredientUnit={line.ingredient.unit}
                  title="Recommended"
                  today={today}
                  onAdd={() =>
                    onAddReceived(toPrefill(line.ingredient.id, line.best!))
                  }
                />
                {line.alternative ? (
                  <View style={formStyles.alternative}>
                    <OptionCard
                      option={line.alternative}
                      ingredientUnit={line.ingredient.unit}
                      title="Alternative"
                      today={today}
                      onAdd={() =>
                        onAddReceived(
                          toPrefill(line.ingredient.id, line.alternative!),
                        )
                      }
                    />
                  </View>
                ) : null}
              </>
            ) : (
              <Body>
                No suitable option is available by {formatDate(neededBy)}.
                {line.excludedCount > 0
                  ? ` ${line.excludedCount} listed option${
                      line.excludedCount === 1 ? ' is' : 's are'
                    } out of stock or would arrive too late.`
                  : ' No supplier lists this ingredient.'}
              </Body>
            )}
            {line.best && line.excludedCount > 0 ? (
              <Body muted>
                {line.excludedCount} other option
                {line.excludedCount === 1 ? '' : 's'} left out (out of stock or
                arriving after {formatDate(neededBy)}).
              </Body>
            ) : null}
          </Card>
        ))
      )}
    </>
  );
}
