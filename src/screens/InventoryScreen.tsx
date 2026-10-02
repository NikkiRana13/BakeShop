import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
  Notice,
  Row,
  Screen,
  SectionTitle,
  Sheet,
  Stat,
  useLayout,
  Grid,
} from '../components/ui';
import { finishedStock, ingredientStatus } from '../logic/selectors';
import { useNav } from '../navigation';
import { useStore } from '../state/store';
import { Ingredient } from '../types';
import { formatDate, formatQty, relativeDays, todayKey } from '../utils/format';

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

function IngredientCard({
  ingredient,
  today,
  onDiscardExpired,
}: {
  ingredient: Ingredient;
  today: string;
  onDiscardExpired: () => void;
}) {
  const st = ingredientStatus(ingredient, today);
  const tone = st.hasExpired ? 'bad' : st.isLow || st.expiresSoon ? 'warn' : 'plain';
  return (
    <Card tone={tone}>
      <Row style={localStyles.between}>
        <Body bold style={localStyles.name}>
          {ingredient.name}
        </Body>
        <Body bold>{formatQty(st.usable, ingredient.unit)}</Body>
      </Row>
      <Body muted>
        {ingredient.expiryDate && st.daysLeft !== null && st.daysLeft >= 0
          ? `Expires ${formatDate(ingredient.expiryDate)} · ${relativeDays(st.daysLeft)}`
          : st.usable > 0
          ? 'No expiry date recorded'
          : 'None usable on hand'}
      </Body>
      <Body muted>
        Low-stock level: {formatQty(ingredient.lowStockThreshold, ingredient.unit)}
      </Body>
      <Row>
        {st.isLow ? <Badge tone="warn" label="Low stock" /> : null}
        {st.expiresSoon ? (
          <Badge tone="warn" icon="⏰" label={`Expires ${relativeDays(st.daysLeft ?? 0)}`} />
        ) : null}
        {st.hasExpired ? (
          <Badge tone="bad" label={`Expired: ${formatQty(st.expired, ingredient.unit)} (not usable)`} />
        ) : null}
        {!st.isLow && !st.expiresSoon && !st.hasExpired ? (
          <Badge tone="good" label="Stock OK" />
        ) : null}
      </Row>
      {st.hasExpired ? (
        <Button
          label="Discard expired stock"
          variant="secondary"
          onPress={onDiscardExpired}
        />
      ) : null}
    </Card>
  );
}

export function InventoryScreen() {
  const { state } = useStore();
  const nav = useNav();
  const today = todayKey();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [sheetKey, setSheetKey] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const { wide } = useLayout();
  const gridBtn = wide ? localStyles.gridBtnWide : localStyles.gridBtn;

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

  return (
    <Screen
      title="Inventory"
      subtitle="Ingredients, batches and shopping help">
      <Notice text={flash} tone="good" />
      <View style={localStyles.grid}>
        <Button
          style={gridBtn}
          label="Add stock"
          icon="＋"
          onPress={() => open({ kind: 'stock' })}
        />
        <Button
          style={gridBtn}
          label="Record batch"
          icon="🥣"
          onPress={() => open({ kind: 'batch' })}
        />
        <Button
          style={gridBtn}
          label="Find missing ingredients"
          icon="🔍"
          variant="secondary"
          onPress={() => open({ kind: 'shop' })}
        />
        <Button
          style={gridBtn}
          label="Record ingredient waste"
          icon="🗑"
          variant="secondary"
          onPress={() => open({ kind: 'waste' })}
        />
      </View>

      <SectionTitle>Ingredients</SectionTitle>
      <Grid>
        {state.ingredients.map(ing => (
        <IngredientCard
          key={ing.id}
          ingredient={ing}
          today={today}
          onDiscardExpired={() =>
            open({ kind: 'waste', ingredientId: ing.id, expired: true })
          }
        />
        ))}
      </Grid>
      <Body muted>
        Simplified tracking: each ingredient keeps one expiry date. When new
        stock is added to existing stock, the earlier date is kept so nothing
        is used late. Expired stock is set aside and not counted as usable.
      </Body>

      <SectionTitle>Finished treats ready to sell</SectionTitle>
      <Card>
        {state.treats.map(t => (
          <Stat
            key={t.id}
            label={t.name}
            value={`${finishedStock(state, t.id)} servings`}
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

const localStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridBtn: { flexGrow: 1, flexBasis: '45%' },
  gridBtnWide: { flexGrow: 1, flexBasis: '22%' },
  between: { justifyContent: 'space-between' },
  name: { fontSize: 19 },
});
