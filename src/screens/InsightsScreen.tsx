import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  DateRangePicker,
  RangeChoice,
  rangeLabel,
  toRangeInput,
} from '../components/DateRangePicker';
import {
  Badge,
  Body,
  Button,
  Card,
  Screen,
  SectionTitle,
  Stat,
  Stepper,
} from '../components/ui';
import { setBatchSize } from '../logic/actions';
import {
  buildRecommendations,
  Recommendation,
  RecKind,
} from '../logic/recommendations';
import { costAdvice } from '../logic/vendors';
import { useNav } from '../navigation';
import { useStore } from '../state/store';
import { colors, radius } from '../theme';
import { todayKey } from '../utils/format';

const TONE: Record<RecKind, 'plain' | 'warm' | 'good' | 'warn'> = {
  reduce: 'warn',
  expiring: 'warm',
  increase: 'good',
  buy_first: 'warn',
  top: 'good',
  review_costs: 'warn',
  same: 'plain',
  track: 'plain',
};

/** Large expand control. Points down to open, up to close; not a trend. */
function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <View style={styles.chevronBox}>
      <View
        style={[
          styles.chevron,
          { transform: [{ rotate: expanded ? '-135deg' : '45deg' }] },
          expanded && styles.chevronUp,
        ]}
      />
    </View>
  );
}

function BatchSizeEditor({ rec }: { rec: Recommendation }) {
  const { run } = useStore();
  const [size, setSize] = useState(rec.treat.batchSize ?? 8);
  const [message, setMessage] = useState<string | null>(null);
  const save = (value: number | null) => {
    const err = run(s => setBatchSize(s, rec.treat.id, value));
    setMessage(
      err ??
        (value
          ? `Saved: one batch makes ${value}.`
          : 'Batch size cleared; suggestions will use servings.'),
    );
  };
  return (
    <View style={styles.editor}>
      <Stepper
        label={`Standard batch size for ${rec.treat.name}`}
        value={size}
        onChange={setSize}
        max={500}
        suffix="parfaits"
      />
      <View style={styles.editorButtons}>
        <Button
          label="Save batch size"
          variant="secondary"
          onPress={() => save(size)}
        />
        {rec.treat.batchSize ? (
          <Button
            label="Clear batch size"
            variant="quiet"
            onPress={() => save(null)}
          />
        ) : null}
      </View>
      {message ? <Body muted>{message}</Body> : null}
    </View>
  );
}

function RecommendationCard({
  rec,
  expanded,
  onToggle,
}: {
  rec: Recommendation;
  expanded: boolean;
  onToggle: () => void;
}) {
  const nav = useNav();
  const showMostSold =
    rec.mostSold === 'tied' || (rec.mostSold === 'sole' && rec.kind !== 'top');
  return (
    <Card tone={TONE[rec.kind]} style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Show less' : 'See why'}: ${
          rec.treat.name
        }, ${rec.label}`}
        accessibilityState={{ expanded }}
        // react-native-web only exposes the expanded state via aria-expanded.
        aria-expanded={expanded}
        onPress={onToggle}
        style={({ pressed }) => [styles.pressArea, pressed && styles.pressed]}>
        <Text style={styles.treatName}>{rec.treat.name}</Text>
        <Text style={styles.label}>{rec.label}</Text>
        {showMostSold ? (
          <Badge
            tone="good"
            icon="★"
            label={rec.mostSold === 'tied' ? 'Most sold (tied)' : 'Most sold'}
          />
        ) : null}
        <Text style={styles.explanation}>{rec.explanation}</Text>
        {rec.stats.map(st => (
          <Text key={st} style={styles.stat}>
            {st}
          </Text>
        ))}
        <View style={styles.expandRow}>
          <Chevron expanded={expanded} />
          <Text style={styles.expandText}>
            {expanded ? 'Show less' : 'See why'}
          </Text>
        </View>
      </Pressable>
      {expanded ? (
        <View style={styles.details}>
          <Text style={styles.detailsTitle} accessibilityRole="header">
            How we worked this out
          </Text>
          {rec.numbers.map(n => (
            <Stat key={n.label} label={n.label} value={n.value} />
          ))}
          <View style={styles.workings}>
            {rec.workings.map(w => (
              <Text key={w} style={styles.working}>
                • {w}
              </Text>
            ))}
          </View>
          {rec.kind === 'buy_first' ? (
            <Button
              label="Find missing ingredients"
              onPress={() =>
                nav.go('inventory', {
                  kind: 'shop',
                  treatId: rec.treat.id,
                  servings: rec.servings,
                })
              }
            />
          ) : null}
          {rec.kind === 'increase' || rec.kind === 'expiring' ? (
            <Button
              label="Plan a batch"
              onPress={() =>
                nav.go('inventory', {
                  kind: 'batch',
                  treatId: rec.treat.id,
                  servings: rec.servings || undefined,
                })
              }
            />
          ) : null}
          {rec.kind !== 'expiring' ? <BatchSizeEditor rec={rec} /> : null}
        </View>
      ) : null}
    </Card>
  );
}

export function InsightsScreen() {
  const { state } = useStore();
  const today = todayKey();
  const [range, setRange] = useState<RangeChoice>({ kind: 'week' });
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { cards, basisNote } = buildRecommendations(
    state,
    toRangeInput(range),
    today,
  );
  const nav = useNav();
  // Ingredient-level, so it sits apart from the per-treat decision cards.
  const costTips = costAdvice(state, today);

  return (
    <Screen title="What's Selling?" subtitle="What to make next, and why">
      <DateRangePicker value={range} onChange={setRange} />
      <Text style={styles.period}>{rangeLabel(range)}</Text>
      {basisNote ? (
        <Card>
          <Body>ⓘ {basisNote}</Body>
        </Card>
      ) : null}
      {cards.map(rec => (
        <RecommendationCard
          key={rec.id}
          rec={rec}
          expanded={!!open[rec.id]}
          onToggle={() => setOpen(o => ({ ...o, [rec.id]: !o[rec.id] }))}
        />
      ))}
      {costTips.length > 0 ? (
        <>
          <SectionTitle>Where your money goes</SectionTitle>
          {costTips.map(tip => (
            <Card key={tip.id} tone="warn">
              <Badge tone="warn" icon="$" label="Biggest cost" />
              <Body bold>{tip.title}</Body>
              <Body>{tip.body}</Body>
              <Button
                label="See other options"
                icon="🛒"
                variant="secondary"
                onPress={() =>
                  nav.go('vendors', {
                    kind: 'research',
                    ingredientId: tip.ingredientId,
                  })
                }
              />
            </Card>
          ))}
        </>
      ) : null}
      <Body muted>
        Suggestions are simple rules based on your records, not a forecast.
        Money figures exclude sales tax. Ingredient margin does not include
        labour, rent or other overhead.
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  period: { fontSize: 20, fontWeight: '700', color: colors.text },
  card: { padding: 20, gap: 0 },
  pressArea: { gap: 10, borderRadius: radius.md },
  pressed: { opacity: 0.85 },
  treatName: { fontSize: 20, fontWeight: '600', color: colors.muted },
  label: { fontSize: 30, fontWeight: '800', color: colors.text, lineHeight: 36 },
  explanation: { fontSize: 20, color: colors.text, lineHeight: 28 },
  stat: { fontSize: 20, fontWeight: '700', color: colors.text },
  expandRow: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 8,
    minHeight: 72,
    justifyContent: 'center',
  },
  chevronBox: {
    width: 56,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    width: 30,
    height: 30,
    borderRightWidth: 7,
    borderBottomWidth: 7,
    borderColor: colors.accent,
    borderRadius: 3,
    marginTop: -14,
  },
  chevronUp: { marginTop: 14 },
  expandText: { fontSize: 19, fontWeight: '800', color: colors.accent },
  details: {
    gap: 10,
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailsTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  workings: { gap: 6, marginTop: 4 },
  working: { fontSize: 18, color: colors.text, lineHeight: 26 },
  editor: { gap: 8, marginTop: 8 },
  editorButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
