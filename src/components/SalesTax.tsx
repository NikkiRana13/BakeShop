import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { allConfirmed, DEMO_RELIEF_DOCUMENT } from '../logic/actions';
import { taxSummary } from '../logic/insights';
import {
  DateRangePicker,
  RangeChoice,
  rangeLabel,
  toRangeInput,
} from './DateRangePicker';
import { useStore } from '../state/store';
import { colors, font, fontFamily, radius } from '../theme';
import { ReliefConfirmation } from '../types';
import { formatCents, todayKey } from '../utils/format';
import { Icon } from './Icon';
import { Badge, Body, Button, Card, Stat } from './ui';

export interface BreakdownAmounts {
  subtotalCents: number;
  taxBeforeRebatesCents: number;
  preparedFoodRebateCents: number;
  firstNationsRebateCents: number;
  taxChargedCents: number;
  totalCents: number;
}

/** Subtotal → tax → rebates → total, used for previews, receipts and details. */
export function TaxBreakdownView({
  amounts,
  rule,
}: {
  amounts: BreakdownAmounts;
  rule?: string;
}) {
  return (
    <View style={styles.breakdown}>
      <Stat label="Subtotal (before tax)" value={formatCents(amounts.subtotalCents)} />
      <Stat
        label="HST before rebates"
        value={formatCents(amounts.taxBeforeRebatesCents)}
      />
      {amounts.preparedFoodRebateCents > 0 ? (
        <Stat
          label="Prepared-food rebate (Ontario)"
          value={`−${formatCents(amounts.preparedFoodRebateCents)}`}
        />
      ) : null}
      {amounts.firstNationsRebateCents > 0 ? (
        <Stat
          label="First Nations rebate (Ontario)"
          value={`−${formatCents(amounts.firstNationsRebateCents)}`}
        />
      ) : null}
      <Stat label="Tax charged" value={formatCents(amounts.taxChargedCents)} />
      <Stat label="Total" value={formatCents(amounts.totalCents)} strong />
      {rule ? <Body muted>Rule: {rule}</Body> : null}
    </View>
  );
}

function Checkbox({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      aria-checked={checked}
      onPress={onToggle}
      style={[styles.check, checked && styles.checkOn]}>
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? (
          <Icon name="check" size={28} color={colors.white} strokeWidth={3.2} />
        ) : null}
      </View>
      <Text style={styles.checkText}>{children}</Text>
    </Pressable>
  );
}

const NO_CONFIRMATIONS: ReliefConfirmation = {
  eligibleIncludingResidency: false,
  documentInspectedInPerson: false,
  purchaseQualifies: false,
};

/**
 * Staff confirmation for Ontario's First Nations point-of-sale rebate.
 * Nothing here changes inventory or saves a sale: it only returns the
 * confirmation to the quick-sale form. No photos or real document numbers
 * are collected; the demo attaches a fictional record instead.
 */
export function FirstNationsReliefForm({
  onApply,
  onCancel,
}: {
  onApply: (c: ReliefConfirmation) => void;
  onCancel: () => void;
}) {
  const [c, setC] = useState<ReliefConfirmation>(NO_CONFIRMATIONS);
  const toggle = (k: keyof ReliefConfirmation) =>
    setC(prev => ({ ...prev, [k]: !prev[k] }));
  return (
    <>
      <Body>
        Ontario's First Nations point-of-sale rebate removes the 8% provincial
        part of HST on qualifying purchases by eligible customers. Identity
        alone does not establish eligibility. Confirm each item below.
      </Body>
      <Checkbox
        checked={c.eligibleIncludingResidency}
        onToggle={() => toggle('eligibleIncludingResidency')}>
        The customer is eligible for Ontario's First Nations point-of-sale
        rebate, including the applicable residency requirement.
      </Checkbox>
      <Checkbox
        checked={c.documentInspectedInPerson}
        onToggle={() => toggle('documentInspectedInPerson')}>
        I inspected an accepted status document in person.
      </Checkbox>
      <Checkbox
        checked={c.purchaseQualifies}
        onToggle={() => toggle('purchaseQualifies')}>
        This purchase qualifies for the rebate (takeaway, not a dine-in
        restaurant meal or catering).
      </Checkbox>
      <Card tone="warn">
        <Badge tone="warn" label="Demo verification record" icon="alert" />
        <Stat label="Purchaser" value={DEMO_RELIEF_DOCUMENT.purchaserName} />
        <Stat label="Document" value={DEMO_RELIEF_DOCUMENT.documentType} />
        <Body muted>
          Fictional record for demo mode. Real rebate sales need the purchaser
          and documentation records Ontario requires; these checkboxes alone
          do not meet that requirement. Do not photograph cards.
        </Body>
      </Card>
      <Button
        label="Apply relief to this sale"
        icon="check"
        onPress={() => onApply(c)}
        disabled={!allConfirmed(c)}
      />
      <Button label="Cancel" variant="quiet" onPress={onCancel} />
    </>
  );
}

/** Collapsible tax summary built only from tax saved with each sale. */
export function TaxSummaryPanel() {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<RangeChoice>({ kind: 'today' });
  const t = taxSummary(state, toRangeInput(range), todayKey());
  return (
    <Card tone="warm" style={styles.panel}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        // react-native-web only exposes the expanded state via aria-expanded.
        aria-expanded={open}
        onPress={() => setOpen(o => !o)}
        style={styles.toggle}>
        <Text style={styles.toggleTitle}>Tax summary · {rangeLabel(range)}</Text>
        <View style={styles.toggleRight}>
          <Text style={styles.toggleText}>{open ? 'Hide' : 'Show'}</Text>
          <Icon
            name={open ? 'chevronUp' : 'chevronDown'}
            size={34}
            color={colors.accent}
            strokeWidth={3}
          />
        </View>
      </Pressable>
      {open ? (
        <>
          <DateRangePicker value={range} onChange={setRange} />
          <Stat label="Sales before tax" value={formatCents(t.salesBeforeTaxCents)} />
          <Stat
            label="HST before point-of-sale rebates"
            value={formatCents(t.hstBeforeRebatesCents)}
          />
          <Stat
            label="Prepared-food rebates credited"
            value={formatCents(t.preparedFoodRebatesCents)}
          />
          <Stat
            label="First Nations rebates credited"
            value={formatCents(t.firstNationsRebatesCents)}
          />
          <Stat
            label="Net tax collected from customers"
            value={formatCents(t.netTaxCollectedCents)}
            strong
          />
          <Stat
            label="Customer payments including tax"
            value={formatCents(t.customerPaymentsCents)}
            strong
          />
          <View style={styles.divider} />
          <Stat
            label="Tax paid on purchases (recorded amounts only)"
            value={formatCents(t.taxPaidOnPurchasesCents)}
          />
          {t.purchasesWithoutRecordedTax > 0 ? (
            <Body muted>
              {t.purchasesWithoutRecordedTax} purchase
              {t.purchasesWithoutRecordedTax === 1 ? ' has' : 's have'} no tax
              amount recorded and {t.purchasesWithoutRecordedTax === 1 ? 'is' : 'are'}{' '}
              not included.
            </Body>
          ) : null}
          <Body muted>
            Totals come from the tax saved with each sale. This is not a tax
            return: it does not work out input tax credits or what is owed to
            the CRA.
          </Body>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  breakdown: { gap: 2 },
  check: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
    minHeight: 64,
    padding: 18,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.controlBorder,
    backgroundColor: colors.white,
  },
  checkOn: { borderColor: colors.green },
  box: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  boxOn: { backgroundColor: colors.green, borderColor: colors.green },
  checkText: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: font.body,
    color: colors.text,
    lineHeight: 36,
  },
  panel: { paddingVertical: 12 },
  toggle: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    minHeight: 76,
  },
  toggleTitle: {
    fontFamily: fontFamily.display,
    fontSize: 34,
    fontWeight: '600',
    color: colors.text,
  },
  toggleRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleText: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    fontWeight: '600',
    color: colors.accent,
  },
  divider: { height: 2, backgroundColor: colors.divider, marginVertical: 6 },
});
