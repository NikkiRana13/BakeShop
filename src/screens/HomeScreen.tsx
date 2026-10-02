import React from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import {
  Badge,
  Body,
  Button,
  Card,
  Screen,
  SectionTitle,
} from '../components/ui';
import { bestSeller, expiringIngredientAdvice } from '../logic/insights';
import {
  finishedStock,
  ingredientStatus,
  revenueOnDay,
} from '../logic/selectors';
import { Intent, TabName, useNav } from '../navigation';
import { useStore } from '../state/store';
import { colors } from '../theme';
import {
  addDays,
  formatCents,
  formatDayLabel,
  formatQty,
  relativeDays,
  todayKey,
} from '../utils/format';

interface Attention {
  id: string;
  tone: 'warn' | 'bad';
  label: string;
  text: string;
  action: string;
  tab: TabName;
  intent?: Intent;
}

function SummaryTile({
  label,
  value,
  detail,
  onPress,
}: {
  label: string;
  value: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.tile}>
      <Card style={styles.tileCard}>
        <Body muted>{label}</Body>
        <Body bold style={styles.tileValue}>
          {value}
        </Body>
        <Body muted style={styles.tileDetail}>
          {detail}
        </Body>
        <Button label="View" variant="quiet" onPress={onPress} />
      </Card>
    </View>
  );
}

export function HomeScreen() {
  const { state, resetDemo } = useStore();
  const nav = useNav();
  const today = todayKey();
  const withStatus = state.ingredients.map(ing => ({
    ing,
    st: ingredientStatus(ing, today),
  }));
  const expiring = withStatus.filter(x => x.st.expiresSoon && x.st.usable > 0);
  const low = withStatus.filter(x => x.st.isLow);
  const expired = withStatus.filter(x => x.st.hasExpired);
  const revenue = revenueOnDay(state, today);
  const top = bestSeller(state, today);
  const recommendation = expiringIngredientAdvice(state, today)[0];

  const attention: Attention[] = [];
  for (const { ing, st } of expiring) {
    attention.push({
      id: `exp-${ing.id}`,
      tone: 'warn',
      label: 'Expires soon',
      text: `${ing.name}: ${formatQty(st.usable, ing.unit)} ${
        ing.plural ? 'expire' : 'expires'
      } ${relativeDays(st.daysLeft ?? 0)}.`,
      action: 'See inventory',
      tab: 'inventory',
    });
  }
  for (const { ing, st } of expired) {
    attention.push({
      id: `expired-${ing.id}`,
      tone: 'bad',
      label: 'Expired',
      text: `${ing.name}: ${formatQty(st.expired, ing.unit)} has expired and is not counted as usable.`,
      action: 'See inventory',
      tab: 'inventory',
    });
  }
  for (const { ing, st } of low) {
    attention.push({
      id: `low-${ing.id}`,
      tone: 'warn',
      label: 'Low stock',
      text: `${ing.name} is low: ${formatQty(st.usable, ing.unit)} left (aim for at least ${formatQty(
        ing.lowStockThreshold,
        ing.unit,
      )}).`,
      action: 'Find where to buy',
      tab: 'inventory',
      intent: { kind: 'shop', treatId: top?.treat.id },
    });
  }
  for (const t of state.treats) {
    if (finishedStock(state, t.id) === 0) {
      attention.push({
        id: `out-${t.id}`,
        tone: 'warn',
        label: 'Sold out',
        text: `No ${t.name} ready to sell.`,
        action: 'Record a batch',
        tab: 'inventory',
        intent: { kind: 'batch', treatId: t.id },
      });
    }
  }
  for (const c of state.closings) {
    if (c.status === 'needs_review' && c.date >= addDays(today, -6)) {
      const parts = [];
      if (Math.abs(c.cashDiffCents) > 1) {
        parts.push(
          `cash ${c.cashDiffCents < 0 ? 'short' : 'over'} ${formatCents(Math.abs(c.cashDiffCents))}`,
        );
      }
      if (Math.abs(c.cardDiffCents) > 1) {
        parts.push(
          `card ${c.cardDiffCents < 0 ? 'short' : 'over'} ${formatCents(Math.abs(c.cardDiffCents))}`,
        );
      }
      attention.push({
        id: `close-${c.date}`,
        tone: 'bad',
        label: 'Needs review',
        text: `${formatDayLabel(c.date, today)}'s closing: ${parts.join(', ')}.`,
        action: 'Review closing',
        tab: 'sales',
        intent: { kind: 'closing', day: c.date },
      });
    }
  }

  const confirmReset = () => {
    if (Platform.OS === 'web') {
      // Alert is a no-op on react-native-web.
      const { confirm } = globalThis as unknown as {
        confirm: (message: string) => boolean;
      };
      if (
        confirm(
          'Reset demo data? This erases everything recorded and restores the sample bakery data.',
        )
      ) {
        resetDemo();
      }
      return;
    }
    Alert.alert(
      'Reset demo data?',
      'This erases everything recorded and restores the sample bakery data.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetDemo },
      ],
    );
  };

  return (
    <Screen title="Grandma's Order Desk" subtitle="Good day! Here's your bakery at a glance.">
      <View style={styles.grid}>
        <SummaryTile
          label="Expiring within 7 days"
          value={String(expiring.length)}
          detail={expiring.map(x => x.ing.name).join(', ') || 'Nothing soon'}
          onPress={() => nav.go('inventory')}
        />
        <SummaryTile
          label="Low stock"
          value={String(low.length)}
          detail={low.map(x => x.ing.name).join(', ') || 'All stocked'}
          onPress={() => nav.go('inventory')}
        />
        <SummaryTile
          label="Today's revenue"
          value={formatCents(revenue)}
          detail="From recorded sales"
          onPress={() => nav.go('sales')}
        />
        <SummaryTile
          label="Best seller (7 days)"
          value={top ? `${top.unitsSold} sold` : '—'}
          detail={top ? top.treat.name : 'No sales yet'}
          onPress={() => nav.go('insights')}
        />
      </View>

      {recommendation ? (
        <Card tone="warm">
          <Badge tone="info" icon="💡" label="Suggestion" />
          <Body bold>{recommendation.title}</Body>
          <Body>{recommendation.body}</Body>
          <Button
            label="Plan a batch"
            onPress={() =>
              nav.go('inventory', { kind: 'batch', treatId: recommendation.treatId })
            }
          />
        </Card>
      ) : null}

      <SectionTitle>Grandma, here's what needs attention</SectionTitle>
      {attention.length === 0 ? (
        <Card tone="good">
          <Body>✓ All caught up. Nothing needs attention right now.</Body>
        </Card>
      ) : (
        attention.map(a => (
          <Card key={a.id} tone={a.tone}>
            <Badge tone={a.tone} label={a.label} />
            <Body>{a.text}</Body>
            <Button
              label={a.action}
              variant="secondary"
              onPress={() => nav.go(a.tab, a.intent)}
            />
          </Card>
        ))
      )}

      <SectionTitle>Demo</SectionTitle>
      <Body muted>
        Supplier prices and history are fictional demo data. Resetting restores
        the sample bakery as of today.
      </Body>
      <Button label="Reset demo data" variant="quiet" onPress={confirmReset} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  tile: { width: '50%', padding: 5 },
  tileCard: { flex: 1, gap: 4 },
  tileValue: { fontSize: 26, color: colors.text },
  tileDetail: { minHeight: 40 },
});
