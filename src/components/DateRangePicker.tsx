import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RangeInput } from '../logic/insights';
import {
  addDays,
  daysBetween,
  formatDate,
  parseDateKey,
  todayKey,
} from '../utils/format';
import { Choices, Field, useLayout } from './ui';

export type RangeChoice =
  | { kind: 'today' }
  | { kind: 'week' }
  | { kind: 'custom'; from: string; to: string };

export const MAX_RANGE_DAYS = 366;

export function toRangeInput(c: RangeChoice): RangeInput {
  return c.kind === 'custom' ? { from: c.from, to: c.to } : c.kind;
}

export function rangeLabel(c: RangeChoice): string {
  if (c.kind === 'today') {
    return 'Today';
  }
  if (c.kind === 'week') {
    return 'Last 7 days';
  }
  return c.from === c.to
    ? formatDate(c.from)
    : `${formatDate(c.from)} – ${formatDate(c.to)}`;
}

/** Plain-language problem with a typed range, or null when it is usable. */
export function rangeError(from: string, to: string): string | null {
  if (!parseDateKey(from) || !parseDateKey(to)) {
    return 'Enter both dates as YYYY-MM-DD.';
  }
  const days = daysBetween(from, to);
  if (days < 0) {
    return 'The "From" date must be on or before the "To" date.';
  }
  if (days >= MAX_RANGE_DAYS) {
    return 'Choose a range of one year or less.';
  }
  return null;
}

/**
 * From/To date fields. Only valid ranges are passed to `onChange`, so
 * screens never compute totals for a half-typed date.
 */
export function CustomRangeFields({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const { wide } = useLayout();
  const [fromText, setFromText] = useState(from);
  const [toText, setToText] = useState(to);
  const error = rangeError(fromText.trim(), toText.trim());
  const update = (f: string, t: string) => {
    setFromText(f);
    setToText(t);
    if (!rangeError(f.trim(), t.trim())) {
      onChange(f.trim(), t.trim());
    }
  };
  return (
    <View style={wide ? styles.row : styles.stack}>
      <View style={styles.field}>
        <Field
          label="From (YYYY-MM-DD)"
          value={fromText}
          onChangeText={f => update(f, toText)}
          autoCapitalize="none"
          hint={parseDateKey(fromText.trim()) ? formatDate(fromText.trim()) : undefined}
        />
      </View>
      <View style={styles.field}>
        <Field
          label="To (YYYY-MM-DD)"
          value={toText}
          onChangeText={t => update(fromText, t)}
          autoCapitalize="none"
          hint={parseDateKey(toText.trim()) ? formatDate(toText.trim()) : undefined}
          error={error}
        />
      </View>
    </View>
  );
}

/** Today / Last 7 days / Custom range. */
export function DateRangePicker({
  value,
  onChange,
}: {
  value: RangeChoice;
  onChange: (c: RangeChoice) => void;
}) {
  const today = todayKey();
  return (
    <>
      <Choices
        value={value.kind}
        onChange={kind =>
          onChange(
            kind === 'custom'
              ? value.kind === 'custom'
                ? value
                : { kind, from: addDays(today, -29), to: today }
              : { kind },
          )
        }
        options={[
          { value: 'today', label: 'Today' },
          { value: 'week', label: 'Last 7 days' },
          { value: 'custom', label: 'Custom range' },
        ]}
      />
      {value.kind === 'custom' ? (
        <CustomRangeFields
          from={value.from}
          to={value.to}
          onChange={(from, to) => onChange({ kind: 'custom', from, to })}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stack: { gap: 12 },
  field: { flex: 1, minWidth: 0 },
});
