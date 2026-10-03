import React from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, IconName } from '../components/Icon';
import { Body, Button, Card, Grid, Screen } from '../components/ui';
import { allTreatStats, expiringIngredientAdvice } from '../logic/insights';
import {
  finishedStock,
  ingredientStatus,
  revenueOnDay,
} from '../logic/selectors';
import { Intent, TabName, useNav } from '../navigation';
import { useStore } from '../state/store';
import { colors, font, fontFamily, radius } from '../theme';
import {
  addDays,
  formatCents,
  formatDayLabel,
  formatQty,
  todayKey,
} from '../utils/format';

interface Attention {
  id: string;
  icon: IconName;
  lead: string;
  rest: string;
  action: string;
  tab: TabName;
  intent?: Intent;
}

function withArticle(phrase: string): string {
  return `${/^[aeiou]/i.test(phrase) ? 'an' : 'a'} ${phrase}`;
}

function daysText(days: number): string {
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
}

function AttentionRow({ item }: { item: Attention }) {
  const nav = useNav();
  return (
    <View style={styles.attentionRow}>
      <Icon name={item.icon} size={40} color={colors.accent} />
      <Text style={styles.attentionText}>
        <Text style={styles.strong}>{item.lead}</Text> {item.rest}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => nav.go(item.tab, item.intent)}
        style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}>
        <Text style={styles.outlineBtnText}>{item.action}</Text>
      </Pressable>
    </View>
  );
}

function SummaryCard({
  icon,
  iconColor,
  label,
  value,
  valueSize = font.number,
  detail,
  link,
  onPress,
}: {
  icon: IconName;
  iconColor: string;
  label: string;
  value: string;
  valueSize?: number;
  detail: string;
  link: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.summary}>
      <View style={styles.summaryHead}>
        <Icon name={icon} size={40} color={iconColor} />
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
      <Text style={[styles.summaryValue, { fontSize: valueSize }]}>{value}</Text>
      <Text style={styles.summaryDetail}>{detail}</Text>
      <Pressable
        accessibilityRole="link"
        onPress={onPress}
        style={styles.summaryLink}>
        <Text style={styles.summaryLinkText}>{link}</Text>
      </Pressable>
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
  const week = allTreatStats(state, 'week', today);
  const maxSold = Math.max(0, ...week.map(s => s.unitsSold));
  const top = week.filter(s => maxSold > 0 && s.unitsSold === maxSold);
  const advice = expiringIngredientAdvice(state, today);

  const attention: Attention[] = [];
  for (const { ing, st } of expiring) {
    const use = advice.find(a => a.id === `expiring-${ing.id}`);
    const treat = state.treats.find(t => t.id === use?.treatId);
    attention.push({
      id: `exp-${ing.id}`,
      icon: 'clock',
      lead: `${ing.name} ${ing.plural ? 'expire' : 'expires'} ${daysText(
        st.daysLeft ?? 0,
      )}.`,
      rest: treat
        ? `Use ${ing.plural ? 'them' : 'it'} in ${withArticle(
            `${treat.name.replace(/ Parfait$/, '')} batch`,
          )}.`
        : `${formatQty(st.usable, ing.unit)} to use up.`,
      action: treat ? 'Plan a batch' : 'See inventory',
      tab: 'inventory',
      intent: treat ? { kind: 'batch', treatId: treat.id } : undefined,
    });
  }
  for (const { ing, st } of expired) {
    attention.push({
      id: `expired-${ing.id}`,
      icon: 'alert',
      lead: `Some ${ing.name.toLowerCase()} has expired.`,
      rest: `${formatQty(st.expired, ing.unit)} is not counted as usable.`,
      action: 'See inventory',
      tab: 'inventory',
    });
  }
  for (const { ing, st } of low) {
    attention.push({
      id: `low-${ing.id}`,
      icon: 'alert',
      lead: `${ing.name} is low.`,
      rest: `${formatQty(st.usable, ing.unit)} left; you usually keep ${formatQty(
        ing.lowStockThreshold,
        ing.unit,
      )}.`,
      action: `Find ${ing.name.toLowerCase()}`,
      tab: 'inventory',
      intent: { kind: 'shop', treatId: top[0]?.treat.id },
    });
  }
  for (const t of state.treats) {
    if (finishedStock(state, t.id) === 0) {
      attention.push({
        id: `out-${t.id}`,
        icon: 'alert',
        lead: `No ${t.name} ready.`,
        rest: 'Make a batch to sell more.',
        action: 'Record a batch',
        tab: 'inventory',
        intent: { kind: 'batch', treatId: t.id },
      });
    }
  }
  for (const c of state.closings) {
    if (c.status === 'needs_review' && c.date >= addDays(today, -6)) {
      const parts: string[] = [];
      if (Math.abs(c.cashDiffCents) > 1) {
        parts.push(
          `cash was ${formatCents(Math.abs(c.cashDiffCents))} ${
            c.cashDiffCents < 0 ? 'short' : 'over'
          }`,
        );
      }
      if (Math.abs(c.cardDiffCents) > 1) {
        parts.push(
          `card was ${formatCents(Math.abs(c.cardDiffCents))} ${
            c.cardDiffCents < 0 ? 'short' : 'over'
          }`,
        );
      }
      attention.push({
        id: `close-${c.date}`,
        icon: 'receipt',
        lead: `${formatDayLabel(c.date, today)}’s ${parts.join(' and ')}.`,
        rest: 'Check the drawer count.',
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

  const firstExpiring = expiring[0];
  const firstLow = low[0];

  return (
    <Screen title="Hello, Grandma" subtitle="Here is your bakery today.">
      <View style={styles.attention}>
        <Text style={styles.attentionTitle} accessibilityRole="header">
          Here’s what needs attention
        </Text>
        {attention.length === 0 ? (
          <View style={styles.attentionRow}>
            <Icon name="check" size={40} color={colors.green} />
            <Text style={styles.attentionText}>
              <Text style={styles.strong}>All caught up.</Text> Nothing needs
              attention right now.
            </Text>
          </View>
        ) : (
          attention.map(a => <AttentionRow key={a.id} item={a} />)
        )}
      </View>

      <Grid columns={2}>
        <SummaryCard
          icon="clock"
          iconColor={colors.accent}
          label="Expiring soon"
          value={String(expiring.length)}
          detail={
            firstExpiring
              ? expiring.length === 1
                ? `${firstExpiring.ing.name}, ${daysText(
                    firstExpiring.st.daysLeft ?? 0,
                  )}`
                : expiring.map(x => x.ing.name).join(', ')
              : 'Nothing in the next 7 days'
          }
          link="See inventory"
          onPress={() => nav.go('inventory')}
        />
        <SummaryCard
          icon="alert"
          iconColor={colors.accent}
          label="Low stock"
          value={String(low.length)}
          detail={
            firstLow
              ? low.length === 1
                ? `${firstLow.ing.name}, ${formatQty(
                    firstLow.st.usable,
                    firstLow.ing.unit,
                  )} left`
                : low.map(x => x.ing.name).join(', ')
              : 'Everything is stocked'
          }
          link="See inventory"
          onPress={() => nav.go('inventory')}
        />
        <SummaryCard
          icon="coins"
          iconColor={colors.green}
          label="Today’s sales"
          value={formatCents(revenue)}
          detail="Before tax"
          link="See sales"
          onPress={() => nav.go('sales')}
        />
        <SummaryCard
          icon="star"
          iconColor={colors.green}
          label="Top seller this week"
          value={
            top.length === 0
              ? 'No sales yet'
              : top.map(s => s.treat.name).join(' and ')
          }
          valueSize={40}
          detail={
            top.length === 0
              ? 'Sales will show here'
              : `${maxSold} sold${top.length > 1 ? ' each (tied)' : ''}`
          }
          link="See sales"
          onPress={() => nav.go('sales')}
        />
      </Grid>

      <Card>
        <Body muted>
          Supplier prices and the sales history are sample demo data.
          Resetting restores the sample bakery as of today.
        </Body>
        <Button label="Reset demo data" variant="quiet" onPress={confirmReset} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  attention: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    paddingHorizontal: 32,
    paddingVertical: 28,
    gap: 18,
  },
  attentionTitle: {
    fontFamily: fontFamily.display,
    fontSize: 34,
    fontWeight: '600',
    color: colors.text,
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 20,
    minHeight: 72,
  },
  attentionText: {
    flex: 1,
    minWidth: 260,
    fontFamily: fontFamily.body,
    fontSize: font.body,
    lineHeight: 36,
    color: colors.text,
  },
  strong: { fontWeight: '600' },
  outlineBtn: {
    minHeight: 60,
    paddingHorizontal: 24,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  outlineBtnText: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    fontWeight: '600',
    color: colors.accent,
  },
  pressed: { opacity: 0.85 },
  summary: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 24,
    paddingVertical: 26,
    gap: 10,
    backgroundColor: colors.white,
  },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  summaryLabel: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    fontWeight: '600',
    color: colors.muted,
  },
  summaryValue: {
    fontFamily: fontFamily.body,
    fontWeight: '700',
    color: colors.text,
  },
  summaryDetail: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: font.small,
    color: colors.text,
  },
  summaryLink: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  summaryLinkText: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    fontWeight: '600',
    color: colors.accent,
    textDecorationLine: 'underline',
  },
});
