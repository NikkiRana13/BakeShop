import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { setBatchSize } from '../logic/actions';
import { buildRecommendations, Recommendation } from '../logic/recommendations';
import { useNav } from '../navigation';
import { useStore } from '../state/store';
import { colors, font, fontFamily, radius } from '../theme';
import { todayKey } from '../utils/format';
import {
  DateRangePicker,
  RangeChoice,
  rangeLabel,
  toRangeInput,
} from './DateRangePicker';
import { BigChevron } from './Icon';
import { Badge, Body, Button, Stepper, useLayout } from './ui';

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
      <View style={styles.buttons}>
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

function PerformanceCard({
  rec,
  expanded,
  onToggle,
}: {
  rec: Recommendation;
  expanded: boolean;
  onToggle: () => void;
}) {
  const nav = useNav();
  const { wide } = useLayout();
  const topLabel = rec.mostSold === 'tied' ? 'Top seller (tied)' : 'Top seller';
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Show less' : 'See why'}: ${
          rec.treat.name
        }, ${rec.label}`}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        onPress={onToggle}
        style={({ pressed }) => [styles.press, pressed && styles.pressed]}>
        <View style={styles.nameRow}>
          <Text style={styles.treatName}>{rec.treat.name}</Text>
          {rec.mostSold && rec.label !== 'Top seller' ? (
            <Badge tone="good" icon="star" label={topLabel} />
          ) : null}
        </View>
        <Text style={styles.label}>{rec.label}</Text>
        <Text style={styles.why}>{rec.explanation}</Text>
        {rec.stats.map(st => (
          <Text key={st} style={styles.stat}>
            {st}
          </Text>
        ))}
        <View style={styles.expand}>
          <BigChevron up={expanded} />
          <Text style={styles.expandText}>{expanded ? 'Show less' : 'See why'}</Text>
        </View>
      </Pressable>
      {expanded ? (
        <View style={styles.details}>
          <Text style={styles.detailsTitle} accessibilityRole="header">
            How we worked this out
          </Text>
          <View style={[styles.numbers, wide && styles.numbersWide]}>
            {rec.numbers.map(n => (
              <View key={n.label} style={[styles.number, wide && styles.numberWide]}>
                <Text style={styles.numberLabel}>{n.label}</Text>
                <Text style={styles.numberValue}>{n.value}</Text>
              </View>
            ))}
          </View>
          <View style={styles.steps}>
            {rec.workings.map(w => (
              <Text key={w} style={styles.step}>
                {w}
              </Text>
            ))}
          </View>
          <Body muted>
            Ingredient margin is sales before tax minus ingredient and
            packaging cost. Labour, rent and other costs are not included.
          </Body>
          {rec.kind === 'buy_first' ? (
            <Button
              label="Find missing ingredients"
              icon="search"
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
              icon="bowl"
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
    </View>
  );
}

/** "How each treat is doing": decision cards with "See why" details. */
export function TreatPerformance() {
  const { state } = useStore();
  const today = todayKey();
  const [range, setRange] = useState<RangeChoice>({ kind: 'week' });
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { cards, basisNote } = buildRecommendations(
    state,
    toRangeInput(range),
    today,
  );
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          How each treat is doing
        </Text>
        <Body muted>
          {rangeLabel(range)}. Suggestions, not promises.
        </Body>
      </View>
      <DateRangePicker value={range} onChange={setRange} />
      {basisNote ? <Body muted>{basisNote}</Body> : null}
      {cards.map(rec => (
        <PerformanceCard
          key={rec.id}
          rec={rec}
          expanded={!!open[rec.id]}
          onToggle={() => setOpen(o => ({ ...o, [rec.id]: !o[rec.id] }))}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 20 },
  head: { gap: 6 },
  title: {
    fontFamily: fontFamily.display,
    fontSize: font.heading,
    fontWeight: '600',
    color: colors.text,
  },
  card: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  press: { paddingHorizontal: 32, paddingTop: 28, paddingBottom: 18, gap: 10 },
  pressed: { opacity: 0.85 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 },
  treatName: {
    fontFamily: fontFamily.body,
    fontSize: font.body,
    fontWeight: '600',
    color: colors.muted,
  },
  label: {
    fontFamily: fontFamily.display,
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '600',
    color: colors.text,
  },
  why: {
    fontFamily: fontFamily.body,
    fontSize: font.body,
    lineHeight: 38,
    color: colors.text,
  },
  stat: {
    fontFamily: fontFamily.body,
    fontSize: font.body,
    fontWeight: '700',
    color: colors.text,
  },
  expand: { alignItems: 'center', marginTop: 6, minHeight: 72, justifyContent: 'center' },
  expandText: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    fontWeight: '700',
    color: colors.accent,
  },
  details: {
    marginHorizontal: 32,
    marginBottom: 28,
    paddingTop: 22,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    gap: 14,
  },
  detailsTitle: {
    fontFamily: fontFamily.display,
    fontSize: font.subheading,
    fontWeight: '600',
    color: colors.text,
  },
  numbers: { gap: 4 },
  numbersWide: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 40 },
  number: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 6,
    borderBottomWidth: 2,
    borderBottomColor: colors.divider,
  },
  numberWide: { flexBasis: '45%', flexGrow: 1 },
  numberLabel: {
    flexShrink: 1,
    fontFamily: fontFamily.body,
    fontSize: font.small,
    color: colors.text,
  },
  numberValue: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    fontWeight: '700',
    color: colors.text,
  },
  steps: {
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    paddingHorizontal: 22,
    paddingVertical: 18,
    gap: 8,
  },
  step: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    lineHeight: 34,
    color: colors.text,
  },
  editor: { gap: 10, marginTop: 8 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
