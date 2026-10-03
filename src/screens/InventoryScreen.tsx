import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../components/Icon';
import {
  AddStockForm,
  BatchForm,
  IngredientWasteForm,
  ShoppingForm,
  StockPrefill,
} from '../components/InventoryForms';
import {
  Badge,
  Body,
  Button,
  Card,
  Disclosure,
  Notice,
  Screen,
  SectionTitle,
  Sheet,
  Stat,
  useLayout,
} from '../components/ui';
import { allTreatStats } from '../logic/insights';
import { finishedStock, ingredientStatus } from '../logic/selectors';
import { OfferOption, planShopping } from '../logic/shopping';
import { useNav } from '../navigation';
import { useStore } from '../state/store';
import { colors, font, fontFamily, radius } from '../theme';
import { Ingredient } from '../types';
import {
  daysBetween,
  formatCents,
  formatDate,
  formatQty,
  todayKey,
} from '../utils/format';

type SheetState =
  | { kind: 'stock'; prefill?: StockPrefill }
  | { kind: 'waste'; ingredientId?: string; expired?: boolean }
  | { kind: 'batch'; treatId?: string; servings?: number }
  | { kind: 'shop'; treatId?: string; servings?: number };

const TITLES: Record<SheetState['kind'], string> = {
  stock: 'Add received stock',
  waste: 'Record ingredient waste',
  batch: 'Record a batch',
  shop: 'Find missing ingredients',
};

/** Servings the inline shopping help plans for (the batch form's default). */
const PLAN_SERVINGS = 16;

function daysText(days: number): string {
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
}

function IngredientRow({
  ingredient,
  today,
  wide,
  onDiscardExpired,
}: {
  ingredient: Ingredient;
  today: string;
  wide: boolean;
  onDiscardExpired: () => void;
}) {
  const st = ingredientStatus(ingredient, today);
  const hasDate =
    ingredient.expiryDate && st.daysLeft !== null && st.daysLeft >= 0;
  return (
    <View style={[styles.row, wide ? styles.rowWide : styles.rowNarrow]}>
      <Text style={[styles.cell, styles.colName, styles.name]}>
        {ingredient.name}
      </Text>
      <Text style={[styles.cell, styles.colQty, styles.qty]}>
        {formatQty(st.usable, ingredient.unit)}
      </Text>
      <View style={[styles.cell, styles.colDate]}>
        <Text style={styles.date}>
          {hasDate ? formatDate(ingredient.expiryDate as string) : 'No date'}
        </Text>
        <Text style={styles.days}>
          {hasDate
            ? daysText(st.daysLeft ?? 0)
            : st.usable > 0
            ? 'Not recorded'
            : 'None usable'}
        </Text>
      </View>
      <View style={[styles.cell, styles.colStatus, styles.statusCell]}>
        {st.expiresSoon ? <Badge tone="warn" icon="clock" label="Use soon" /> : null}
        {st.isLow ? <Badge tone="warn" icon="alert" label="Low stock" /> : null}
        {st.hasExpired ? (
          <Badge
            tone="bad"
            icon="alert"
            label={`Expired: ${formatQty(st.expired, ingredient.unit)}`}
          />
        ) : null}
        {!st.isLow && !st.expiresSoon && !st.hasExpired ? (
          <Badge tone="good" icon="check" label="Good" />
        ) : null}
        {st.hasExpired ? (
          <Button
            label="Throw out expired"
            variant="secondary"
            icon="trash"
            onPress={onDiscardExpired}
          />
        ) : null}
      </View>
    </View>
  );
}

function OptionDetails({
  option,
  unit,
  today,
}: {
  option: OfferOption;
  unit: Ingredient['unit'];
  today: string;
}) {
  const { wide } = useLayout();
  const arrives =
    option.offer.leadTimeDays === 0
      ? 'Available today'
      : `Arrives ${formatDate(option.availableDate)} (${daysText(
          daysBetween(today, option.availableDate),
        )})`;
  return (
    <View style={[styles.optionGrid, wide && styles.optionGridWide]}>
      <View style={styles.optionCell}>
        <Text style={styles.optionLabel}>Product</Text>
        <Text style={styles.optionValue}>{option.offer.productName}</Text>
        <Text style={styles.optionNote}>from {option.supplier.name}</Text>
      </View>
      <View style={styles.optionCell}>
        <Text style={styles.optionLabel}>Buy</Text>
        <Text style={styles.optionValue}>
          {option.packages} × {formatQty(option.baseSize, unit)}
        </Text>
      </View>
      <View style={styles.optionCell}>
        <Text style={styles.optionLabel}>Price</Text>
        <Text style={styles.price}>{formatCents(option.totalCents)}</Text>
        <Text style={styles.optionNote}>
          {option.reasons.join('. ')}.{' '}
          {option.supplier.deliveryFeeCents > 0
            ? `Delivery fee (${formatCents(
                option.supplier.deliveryFeeCents,
              )}) not included.`
            : 'Pickup, no delivery fee.'}
        </Text>
      </View>
      <View style={styles.optionCell}>
        <Text style={styles.optionLabel}>Availability</Text>
        <View style={styles.inline}>
          <Icon
            name={option.offer.leadTimeDays === 0 ? 'check' : 'clock'}
            size={30}
            color={colors.green}
            strokeWidth={2.8}
          />
          <Text style={styles.optionValue}>{arrives}</Text>
        </View>
      </View>
    </View>
  );
}

export function InventoryScreen() {
  const { state } = useStore();
  const nav = useNav();
  const { wide } = useLayout();
  const today = todayKey();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [sheetKey, setSheetKey] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [others, setOthers] = useState<Record<string, boolean>>({});

  const open = (s: SheetState) => {
    setSheetKey(k => k + 1);
    setSheet(s);
  };
  const done = (message: string) => {
    setSheet(null);
    setFlash(message);
  };

  useEffect(() => {
    const intent = nav.intent;
    if (intent && (intent.kind === 'batch' || intent.kind === 'shop')) {
      setSheetKey(k => k + 1);
      setSheet({
        kind: intent.kind,
        treatId: intent.treatId,
        servings: intent.servings,
      });
      nav.clearIntent();
    }
  }, [nav]);

  // Inline shopping help plans the week's best seller.
  const week = allTreatStats(state, 'week', today).sort(
    (a, b) => b.unitsSold - a.unitsSold,
  );
  const planTreat =
    (week[0]?.unitsSold ?? 0) > 0 ? week[0].treat : state.treats[0];
  const plan = planShopping(state, planTreat.id, PLAN_SERVINGS, today, today);
  const toPrefill = (ingredientId: string, o: OfferOption): StockPrefill => ({
    ingredientId,
    quantity: o.packages * o.baseSize,
    costCents: o.totalCents,
    supplierName: o.supplier.name,
    productName: `${o.offer.productName}${o.packages > 1 ? ` ×${o.packages}` : ''}`,
  });
  const missingCount = plan.lines.length;

  return (
    <Screen title="Inventory" subtitle="What you have, and what to buy.">
      <Notice text={flash} tone="good" />
      <View style={styles.actions}>
        <Button
          label="Add stock"
          icon="plus"
          onPress={() => open({ kind: 'stock' })}
        />
        <Button
          label="Record a batch"
          icon="bowl"
          variant="secondary"
          onPress={() => open({ kind: 'batch' })}
        />
        <Button
          label="Find missing ingredients"
          icon="search"
          variant="secondary"
          onPress={() => open({ kind: 'shop' })}
        />
      </View>

      <SectionTitle>Ingredients</SectionTitle>
      <View style={styles.table} accessibilityLabel="Ingredients">
        {wide ? (
          <View style={[styles.row, styles.rowWide, styles.headRow]}>
            <Text style={[styles.cell, styles.colName, styles.head]}>Ingredient</Text>
            <Text style={[styles.cell, styles.colQty, styles.head]}>On hand</Text>
            <Text style={[styles.cell, styles.colDate, styles.head]}>Expires</Text>
            <Text style={[styles.cell, styles.colStatus, styles.head]}>Status</Text>
          </View>
        ) : null}
        {state.ingredients.map((ing, i) => (
          <View key={ing.id} style={(i > 0 || wide) && styles.rowDivider}>
            <IngredientRow
              ingredient={ing}
              today={today}
              wide={wide}
              onDiscardExpired={() =>
                open({ kind: 'waste', ingredientId: ing.id, expired: true })
              }
            />
          </View>
        ))}
      </View>
      <View style={styles.inlineWrap}>
        <Body muted>
          Each ingredient keeps one expiry date. When new stock is added, the
          earlier date is kept so nothing is used late.
        </Body>
        <Button
          label="Record ingredient waste"
          variant="quiet"
          icon="trash"
          onPress={() => open({ kind: 'waste' })}
        />
      </View>

      <View style={styles.shopping}>
        <View style={styles.shoppingHead}>
          <Text style={styles.shoppingTitle} accessibilityRole="header">
            Shopping help
          </Text>
          <Text style={styles.shoppingIntro}>
            {missingCount === 0 ? (
              <>
                You have everything you need to make{' '}
                <Text style={styles.strong}>
                  {PLAN_SERVINGS} {planTreat.name}s
                </Text>{' '}
                today.
              </>
            ) : (
              <>
                To make{' '}
                <Text style={styles.strong}>
                  {PLAN_SERVINGS} {planTreat.name}s
                </Text>{' '}
                today, you need {missingCount === 1 ? 'one more thing' : `${missingCount} more things`}.
              </>
            )}
          </Text>
        </View>
        {plan.lines.map(line => (
          <View key={line.ingredient.id} style={styles.need}>
            <Text style={styles.needTitle}>
              {line.ingredient.name}: you need{' '}
              {formatQty(line.missing, line.ingredient.unit)} more
            </Text>
            {line.best ? (
              <>
                <OptionDetails
                  option={line.best}
                  unit={line.ingredient.unit}
                  today={today}
                />
                <View style={styles.inlineWrap}>
                  <Button
                    label="Add received stock"
                    icon="plus"
                    onPress={() =>
                      open({
                        kind: 'stock',
                        prefill: toPrefill(line.ingredient.id, line.best!),
                      })
                    }
                  />
                  {line.alternative ? (
                    <Disclosure
                      open={!!others[line.ingredient.id]}
                      onToggle={() =>
                        setOthers(o => ({
                          ...o,
                          [line.ingredient.id]: !o[line.ingredient.id],
                        }))
                      }
                      openLabel="Hide other options"
                      closedLabel="See other options"
                    />
                  ) : null}
                </View>
                {line.alternative && others[line.ingredient.id] ? (
                  <View style={styles.alternative}>
                    <OptionDetails
                      option={line.alternative}
                      unit={line.ingredient.unit}
                      today={today}
                    />
                    <Button
                      label="Add this instead"
                      variant="secondary"
                      icon="plus"
                      onPress={() =>
                        open({
                          kind: 'stock',
                          prefill: toPrefill(
                            line.ingredient.id,
                            line.alternative!,
                          ),
                        })
                      }
                    />
                  </View>
                ) : null}
              </>
            ) : (
              <Body>
                No listed supplier can deliver it today.{' '}
                {line.excludedCount > 0
                  ? 'Some options are out of stock or arrive later.'
                  : ''}
              </Body>
            )}
          </View>
        ))}
        <Button
          label="Plan something else"
          variant="secondary"
          icon="search"
          onPress={() =>
            open({ kind: 'shop', treatId: planTreat.id, servings: PLAN_SERVINGS })
          }
        />
        <Body muted>
          Supplier prices are sample information, not live prices. Nothing is
          ordered for you.
        </Body>
      </View>

      <SectionTitle>Treats ready to sell</SectionTitle>
      <Card>
        {state.treats.map(t => (
          <Stat
            key={t.id}
            label={t.name}
            value={`${finishedStock(state, t.id)} ready`}
            strong
          />
        ))}
      </Card>

      <Sheet
        visible={sheet !== null}
        title={sheet ? TITLES[sheet.kind] : ''}
        onClose={() => setSheet(null)}>
        {sheet?.kind === 'stock' ? (
          <AddStockForm key={sheetKey} prefill={sheet.prefill} onDone={done} />
        ) : null}
        {sheet?.kind === 'waste' ? (
          <IngredientWasteForm
            key={sheetKey}
            initialIngredientId={sheet.ingredientId}
            initialExpired={sheet.expired}
            onDone={done}
          />
        ) : null}
        {sheet?.kind === 'batch' ? (
          <BatchForm
            key={sheetKey}
            initialTreatId={sheet.treatId}
            initialServings={sheet.servings}
            onDone={done}
            onFindMissing={(treatId, servings) =>
              open({ kind: 'shop', treatId, servings })
            }
          />
        ) : null}
        {sheet?.kind === 'shop' ? (
          <ShoppingForm
            key={sheetKey}
            initialTreatId={sheet.treatId}
            initialServings={sheet.servings}
            onAddReceived={prefill => open({ kind: 'stock', prefill })}
            onMakeBatch={(treatId, servings) =>
              open({ kind: 'batch', treatId, servings })
            }
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  table: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: { paddingHorizontal: 28, paddingVertical: 14, gap: 16 },
  rowWide: { flexDirection: 'row', alignItems: 'center', minHeight: 96 },
  rowNarrow: { gap: 8 },
  rowDivider: { borderTopWidth: 2, borderTopColor: colors.divider },
  headRow: { backgroundColor: colors.cream, minHeight: 64 },
  head: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    fontWeight: '600',
    color: colors.muted,
  },
  cell: { minWidth: 0 },
  colName: { flex: 2.1 },
  colQty: { flex: 1.5 },
  colDate: { flex: 2.1 },
  colStatus: { flex: 2.2 },
  name: {
    fontFamily: fontFamily.body,
    fontSize: 28,
    fontWeight: '600',
    color: colors.text,
  },
  qty: {
    fontFamily: fontFamily.body,
    fontSize: 30,
    fontWeight: '700',
    color: colors.text,
  },
  date: {
    fontFamily: fontFamily.body,
    fontSize: font.body,
    fontWeight: '500',
    color: colors.text,
  },
  days: { fontFamily: fontFamily.body, fontSize: font.small, color: colors.muted },
  statusCell: { gap: 8, alignItems: 'flex-start' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inlineWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 16,
  },
  shopping: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: 32,
    gap: 20,
  },
  shoppingHead: { gap: 6 },
  shoppingTitle: {
    fontFamily: fontFamily.display,
    fontSize: font.heading,
    fontWeight: '600',
    color: colors.text,
  },
  shoppingIntro: {
    fontFamily: fontFamily.body,
    fontSize: font.body,
    lineHeight: 36,
    color: colors.text,
  },
  strong: { fontWeight: '600' },
  need: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 28,
    gap: 22,
  },
  needTitle: {
    fontFamily: fontFamily.body,
    fontSize: 30,
    fontWeight: '700',
    color: colors.text,
  },
  optionGrid: { gap: 20 },
  optionGridWide: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 32 },
  optionCell: { gap: 4, flexBasis: '45%', flexGrow: 1 },
  optionLabel: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    fontWeight: '500',
    color: colors.muted,
  },
  optionValue: {
    fontFamily: fontFamily.body,
    fontSize: font.body,
    fontWeight: '600',
    color: colors.text,
  },
  optionNote: { fontFamily: fontFamily.body, fontSize: font.small, color: colors.text },
  price: {
    fontFamily: fontFamily.body,
    fontSize: 40,
    fontWeight: '700',
    color: colors.text,
  },
  alternative: {
    borderTopWidth: 2,
    borderTopColor: colors.divider,
    paddingTop: 20,
    gap: 16,
  },
});
