import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import {
  Badge,
  Body,
  Button,
  Card,
  Choices,
  Grid,
  Row,
  Screen,
  SectionTitle,
  Stat,
} from '../components/ui';
import {
  Advice,
  allTreatStats,
  Period,
  salesAdvice,
} from '../logic/insights';
import { useNav } from '../navigation';
import { useStore } from '../state/store';
import { formatCents, formatPercent, todayKey } from '../utils/format';

const ADVICE_BADGE: Record<Advice['kind'], { label: string; icon: string }> = {
  larger: { label: 'Bigger batch?', icon: '▲' },
  smaller: { label: 'Smaller batch?', icon: '▼' },
  pricing: { label: 'Check pricing', icon: '$' },
  expiring: { label: 'Use soon', icon: '⏰' },
};

export function InsightsScreen() {
  const { state } = useStore();
  const nav = useNav();
  const today = todayKey();
  const [period, setPeriod] = useState<Period>('week');
  const stats = allTreatStats(state, period, today).sort(
    (a, b) => b.unitsSold - a.unitsSold || b.revenueCents - a.revenueCents,
  );
  const advice = salesAdvice(state, period, today);
  const totalRevenue = stats.reduce((s, x) => s + x.revenueCents, 0);
  const totalUnits = stats.reduce((s, x) => s + x.unitsSold, 0);

  return (
    <Screen title="What's Selling?" subtitle="How each treat is doing">
      <Choices
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'today', label: 'Today' },
          { value: 'week', label: 'Last 7 days' },
        ]}
      />
      <Card tone="warm">
        <Stat label="Treats sold" value={String(totalUnits)} strong />
        <Stat label="Revenue" value={formatCents(totalRevenue)} strong />
      </Card>

      <Grid>
        {stats.map((s, i) => (
        <Card key={s.treat.id}>
          <Row style={styles.between}>
            <Body bold style={styles.name}>
              {s.treat.name}
            </Body>
            {i === 0 && s.unitsSold > 0 ? (
              <Badge tone="good" icon="★" label="Top seller" />
            ) : null}
          </Row>
          <Stat label="Units sold" value={String(s.unitsSold)} strong />
          <Stat label="Revenue" value={formatCents(s.revenueCents)} />
          <Stat
            label="Avg ingredient + packaging cost / serving"
            value={
              s.avgCostPerServingCents === null
                ? 'No sales yet'
                : formatCents(s.avgCostPerServingCents)
            }
          />
          <Stat
            label="Ingredient margin"
            value={
              s.marginPct === null
                ? '—'
                : `${formatCents(s.marginCents)} (${formatPercent(s.marginPct)})`
            }
          />
          <Stat
            label={`Sell-through (${s.unitsSold} of ${s.available} available)`}
            value={s.sellThrough === null ? 'None available' : formatPercent(s.sellThrough)}
          />
          <Stat
            label="Finished treats wasted"
            value={`${s.wasted} (${formatCents(s.wasteCostCents)} cost)`}
          />
        </Card>
        ))}
      </Grid>
      <Body muted>
        Ingredient margin = revenue minus the ingredient and packaging cost of
        the servings sold (oldest batch first, using the cost recorded when
        each batch was made). It does not include labour, rent or other
        overhead. Waste is shown separately and is not part of the margin.
        Sell-through = units sold ÷ (servings on hand at the start + servings
        made in the period).
      </Body>

      <SectionTitle>Suggestions</SectionTitle>
      <Body muted>
        Simple rules based on your records — guidance, not a forecast.
      </Body>
      {advice.length === 0 ? (
        <Card>
          <Body>Nothing stands out right now. Keep recording sales and batches.</Body>
        </Card>
      ) : (
        <Grid>
          {advice.map(a => (
          <Card key={a.id} tone={a.kind === 'smaller' || a.kind === 'pricing' ? 'warn' : 'warm'}>
            <Badge
              tone={a.kind === 'larger' ? 'good' : a.kind === 'expiring' ? 'info' : 'warn'}
              icon={ADVICE_BADGE[a.kind].icon}
              label={ADVICE_BADGE[a.kind].label}
            />
            <Body bold>{a.title}</Body>
            <Body>{a.body}</Body>
            {a.kind === 'expiring' || a.kind === 'larger' ? (
              <Button
                label="Plan a batch"
                variant="secondary"
                onPress={() => nav.go('inventory', { kind: 'batch', treatId: a.treatId })}
              />
            ) : null}
          </Card>
          ))}
        </Grid>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between' },
  name: { fontSize: 19, flexShrink: 1 },
});
