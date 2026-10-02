import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Badge,
  Body,
  Button,
  Card,
  Choices,
  Columns,
  Field,
  Notice,
  Row,
  Screen,
  SectionTitle,
  Sheet,
  Stat,
  Stepper,
} from '../components/ui';
import {
  closeDay,
  computeClosing,
  previewSaleTax,
  sellTreat,
  wasteTreat,
} from '../logic/actions';
import { Fulfilment } from '../logic/tax';
import {
  BreakdownAmounts,
  FirstNationsReliefForm,
  TaxBreakdownView,
  TaxSummaryPanel,
} from '../components/SalesTax';
import {
  dayTotals,
  finishedStock,
  LedgerEntry,
  ledgerForRange,
} from '../logic/selectors';
import {
  CustomRangeFields,
  rangeLabel,
} from '../components/DateRangePicker';
import { DEFAULT_FLOAT_CENTS } from '../data/seed';
import { useNav } from '../navigation';
import { useStore } from '../state/store';
import { Closing, ReliefConfirmation, SalePayment } from '../types';
import { colors } from '../theme';
import {
  addDays,
  centsToInput,
  daysBetween,
  formatCents,
  formatDate,
  formatDayLabel,
  formatTime,
  parseDollars,
  todayKey,
} from '../utils/format';

const PAYMENT_LABEL = {
  cash: 'Paid in cash',
  card: 'Paid by card',
  unpaid: 'Unpaid',
} as const;

const FULFILMENT_LABEL: Record<Fulfilment, string> = {
  takeaway: 'Takeaway',
  dine_in: 'Dine-in',
  catering: 'Catering',
};

interface Receipt {
  title: string;
  payment: SalePayment;
  fulfilment: Fulfilment;
  amounts: BreakdownAmounts;
  rule: string;
}

function QuickSale({ onDone }: { onDone: (m: string) => void }) {
  const { state, run } = useStore();
  const [treatId, setTreatId] = useState(state.treats[0].id);
  const [qty, setQty] = useState(1);
  const [payment, setPayment] = useState<SalePayment>('cash');
  const [fulfilment, setFulfilment] = useState<Fulfilment>('takeaway');
  // Relief lives only in this form until the sale is saved.
  const [relief, setRelief] = useState<ReliefConfirmation | null>(null);
  const [reliefOpen, setReliefOpen] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const treat = state.treats.find(t => t.id === treatId)!;
  const stock = finishedStock(state, treatId);
  const over = qty > stock;
  const tax = previewSaleTax(state, treatId, qty, fulfilment, relief !== null);

  const save = () => {
    if (!tax.ok) {
      return setError(tax.error);
    }
    const err = run(s =>
      sellTreat(s, {
        treatId,
        quantity: qty,
        payment,
        fulfilment,
        firstNationsRelief: relief,
      }),
    );
    if (err) {
      return setError(err);
    }
    setError(null);
    setReceipt({
      title: `${qty} × ${treat.name}`,
      payment,
      fulfilment,
      amounts: tax.breakdown,
      rule: tax.breakdown.rule,
    });
    onDone(
      `Sold ${qty} ${treat.name} for ${formatCents(
        tax.breakdown.totalCents,
      )} including tax (${payment}). ${stock - qty} left.`,
    );
    setQty(1);
    // Eligibility must be confirmed again for every sale.
    setRelief(null);
  };

  return (
    <Card>
      <Choices
        label="Treat"
        value={treatId}
        onChange={id => {
          setTreatId(id);
          setQty(1);
          setError(null);
        }}
        options={state.treats.map(t => ({
          value: t.id,
          label: t.name,
          detail: `${formatCents(t.priceCents)} + tax · ${finishedStock(
            state,
            t.id,
          )} ready`,
        }))}
      />
      <Stepper label="Quantity" value={qty} onChange={setQty} max={99} />
      <Choices
        label="Fulfilment"
        value={fulfilment}
        onChange={setFulfilment}
        options={(['takeaway', 'dine_in', 'catering'] as Fulfilment[]).map(
          f => ({ value: f, label: FULFILMENT_LABEL[f] }),
        )}
      />
      <Choices
        label="Payment"
        value={payment}
        onChange={setPayment}
        options={[
          { value: 'cash', label: 'Cash' },
          { value: 'card', label: 'Card' },
        ]}
      />
      {relief ? (
        <Card tone="good">
          <Badge
            tone="good"
            label="First Nations relief confirmed for this sale (demo record)"
          />
          <Button
            label="Remove relief"
            variant="quiet"
            onPress={() => setRelief(null)}
          />
        </Card>
      ) : (
        <Button
          label="First Nations tax relief"
          variant="secondary"
          onPress={() => setReliefOpen(true)}
          accessibilityHint="Opens a confirmation form. Does not save the sale."
        />
      )}
      {tax.ok ? (
        <>
          <TaxBreakdownView amounts={tax.breakdown} rule={tax.breakdown.rule} />
          {tax.breakdown.notes.map(n => (
            <Body key={n} muted>
              ⓘ {n}
            </Body>
          ))}
        </>
      ) : (
        <Notice text={tax.error} />
      )}
      {stock === 0 ? (
        <Notice text={`No ${treat.name} ready. Record a batch on the Inventory tab first.`} />
      ) : over ? (
        <Notice text={`Only ${stock} ready to sell.`} />
      ) : null}
      <Notice text={error} />
      <Button
        label="Save sale"
        icon="✓"
        onPress={save}
        disabled={over || stock === 0 || !tax.ok}
      />
      {receipt ? (
        <Card tone="warm">
          <Body bold>Receipt · {receipt.title}</Body>
          <Body muted>
            {FULFILMENT_LABEL[receipt.fulfilment]} · {PAYMENT_LABEL[receipt.payment]}
          </Body>
          <TaxBreakdownView amounts={receipt.amounts} rule={receipt.rule} />
        </Card>
      ) : null}
      <Sheet
        visible={reliefOpen}
        title="First Nations tax relief"
        onClose={() => setReliefOpen(false)}>
        {reliefOpen ? (
          <FirstNationsReliefForm
            onApply={c => {
              setRelief(c);
              setReliefOpen(false);
            }}
            onCancel={() => setReliefOpen(false)}
          />
        ) : null}
      </Sheet>
    </Card>
  );
}

function TreatWasteForm({ onDone }: { onDone: (m: string) => void }) {
  const { state, run } = useStore();
  const [treatId, setTreatId] = useState(state.treats[0].id);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('Unsold at closing');
  const [error, setError] = useState<string | null>(null);
  const treat = state.treats.find(t => t.id === treatId)!;
  const stock = finishedStock(state, treatId);

  const save = () => {
    const err = run(s => wasteTreat(s, treatId, qty, reason));
    if (err) {
      return setError(err);
    }
    onDone(`Recorded ${qty} ${treat.name} as waste. No revenue was added.`);
  };

  return (
    <>
      <Choices
        label="Treat"
        value={treatId}
        onChange={id => {
          setTreatId(id);
          setQty(1);
          setError(null);
        }}
        options={state.treats.map(t => ({
          value: t.id,
          label: t.name,
          detail: `${finishedStock(state, t.id)} on hand`,
        }))}
      />
      <Stepper
        label="Servings wasted"
        value={qty}
        onChange={setQty}
        max={Math.max(1, stock)}
      />
      <Choices
        label="Reason"
        value={reason}
        onChange={setReason}
        options={['Unsold at closing', 'Damaged', 'Past best', 'Other'].map(
          r => ({ value: r, label: r }),
        )}
      />
      {stock === 0 ? <Notice text={`No ${treat.name} on hand.`} /> : null}
      <Notice text={error} />
      <Button
        label="Record waste"
        variant="danger"
        onPress={save}
        disabled={stock === 0 || qty > stock}
      />
    </>
  );
}

function ClosingStatus({ closing }: { closing: Closing }) {
  const matched = closing.status === 'matched';
  const describe = (diff: number, what: string) =>
    Math.abs(diff) <= 1
      ? `${what}: matched`
      : `${what}: ${diff < 0 ? 'short' : 'over'} by ${formatCents(Math.abs(diff))}`;
  return (
    <Card tone={matched ? 'good' : 'bad'}>
      <Badge
        tone={matched ? 'good' : 'bad'}
        label={matched ? 'Matched' : 'Needs review'}
      />
      <Body>{describe(closing.cashDiffCents, 'Cash drawer')}</Body>
      <Body>{describe(closing.cardDiffCents, 'Card terminal')}</Body>
      <Body muted>Closed {formatDate(closing.date)} at {formatTime(closing.closedAt)}</Body>
    </Card>
  );
}

function ClosingForm({ day, saved }: { day: string; saved?: Closing }) {
  const { state, run } = useStore();
  const [float, setFloat] = useState(
    centsToInput(saved?.openingFloatCents ?? DEFAULT_FLOAT_CENTS),
  );
  const [cash, setCash] = useState(saved ? centsToInput(saved.actualCashCents) : '');
  const [terminal, setTerminal] = useState(
    saved ? centsToInput(saved.terminalCardCents) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const totals = dayTotals(state, day);
  const floatCents = parseDollars(float);
  const cashCents = parseDollars(cash);
  const terminalCents = parseDollars(terminal);
  const expectedDrawer =
    (floatCents ?? 0) + totals.cashSalesCents - totals.cashExpensesCents;
  const preview =
    floatCents !== null && cashCents !== null && terminalCents !== null
      ? computeClosing(state, day, floatCents, cashCents, terminalCents)
      : null;

  const submit = () => {
    if (floatCents === null || cashCents === null || terminalCents === null) {
      return setError('Enter the opening float, cash counted and terminal total, e.g. 125.50.');
    }
    const err = run(s =>
      closeDay(s, computeClosing(s, day, floatCents, cashCents, terminalCents)),
    );
    setError(err);
  };

  const diffText = (d: number) =>
    `${d > 0 ? '+' : ''}${formatCents(d)}${Math.abs(d) <= 1 ? ' ✓' : ' !'}`;

  return (
    <Card>
      <Badge tone="neutral" label="Daily aggregate reconciliation" icon="Σ" />
      <Body muted>
        Compares the day's totals only. Individual transactions are not
        independently verified.
      </Body>
      <Stat
        label="Expected cash sales (incl. tax charged)"
        value={formatCents(totals.cashSalesCents)}
      />
      <Stat
        label="Expected card sales (incl. tax charged)"
        value={formatCents(totals.cardSalesCents)}
      />
      <Field
        label="Opening cash float ($)"
        keyboardType="decimal-pad"
        value={float}
        onChangeText={setFloat}
      />
      <Stat label="Recorded cash expenses" value={totals.cashExpensesCents > 0 ? `−${formatCents(totals.cashExpensesCents)}` : formatCents(0)} />
      <Stat label="Expected cash in drawer" value={formatCents(expectedDrawer)} strong />
      <Body muted>Opening float + cash sales − cash expenses</Body>
      <Field
        label="Actual cash counted ($)"
        keyboardType="decimal-pad"
        value={cash}
        onChangeText={setCash}
        placeholder={centsToInput(expectedDrawer)}
      />
      <Field
        label="Verifone gross card sales total ($)"
        keyboardType="decimal-pad"
        value={terminal}
        onChangeText={setTerminal}
        placeholder={centsToInput(totals.cardSalesCents)}
        hint="Use the terminal's gross sales total for the day, not the bank deposit."
      />
      {preview ? (
        <>
          <Stat label="Cash difference" value={diffText(preview.cashDiffCents)} strong />
          <Stat label="Card difference" value={diffText(preview.cardDiffCents)} strong />
        </>
      ) : null}
      {totals.cardExpensesCents > 0 ? (
        <Body muted>
          Supplier card payments ({formatCents(totals.cardExpensesCents)}) are
          kept separate and are not part of the card terminal check.
        </Body>
      ) : null}
      <Notice text={error} />
      <Button label={saved ? 'Close day again' : 'Close day'} icon="🔒" onPress={submit} />
    </Card>
  );
}

function LedgerRow({
  entry: e,
  divider,
  showDate,
}: {
  entry: LedgerEntry;
  divider: boolean;
  showDate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sale = e.sale;
  return (
    <View style={[styles.ledgerRow, divider && styles.ledgerDivider]}>
      <View style={styles.ledgerTop}>
        <View style={styles.ledgerMain}>
          <Body bold>{e.description}</Body>
          <Body muted>
            {showDate ? `${formatDate(todayKey(new Date(e.dateTime)))}, ` : ''}
            {formatTime(e.dateTime)} · {e.category}
            {sale ? ` · ${FULFILMENT_LABEL[sale.fulfilment]}` : ''}
          </Body>
          <Row>
            <Badge
              tone={e.payment === 'unpaid' ? 'warn' : 'neutral'}
              icon={e.payment === 'unpaid' ? '!' : e.payment === 'cash' ? '$' : '▭'}
              label={PAYMENT_LABEL[e.payment]}
            />
            {sale && sale.firstNationsRebateCents > 0 ? (
              <Badge tone="info" label="First Nations rebate" />
            ) : null}
          </Row>
        </View>
        <Body
          bold
          style={[styles.amount, { color: e.amountCents < 0 ? colors.red : colors.green }]}>
          {e.amountCents > 0 ? '+' : ''}
          {formatCents(e.amountCents)}
        </Body>
      </View>
      {sale ? (
        <>
          <Button
            label={open ? 'Hide sale details' : 'Sale details'}
            variant="quiet"
            onPress={() => setOpen(o => !o)}
          />
          {open ? (
            <>
              <TaxBreakdownView amounts={sale} rule={sale.taxRule} />
              {sale.reliefRecordId ? (
                <Body muted>Demo verification record on file for this sale.</Body>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

export function SalesScreen() {
  const { state } = useStore();
  const nav = useNav();
  const today = todayKey();
  const [day, setDay] = useState(today);
  // A custom range applies to the transaction list; closing stays per day.
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(
    null,
  );
  const [flash, setFlash] = useState<string | null>(null);
  const [wasteOpen, setWasteOpen] = useState(false);

  useEffect(() => {
    if (nav.intent?.kind === 'closing') {
      setDay(nav.intent.day);
      setCustom(null);
      nav.clearIntent();
    }
  }, [nav]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  const from = custom?.from ?? day;
  const to = custom?.to ?? day;
  const multiDay = from !== to;
  // A custom range of one date behaves like picking that day.
  const closingDay = multiDay ? null : from;
  const periodLabel = custom
    ? rangeLabel({ kind: 'custom', from, to })
    : formatDayLabel(day, today);
  const ledger = ledgerForRange(state, from, to);
  const closing = closingDay
    ? state.closings.find(c => c.date === closingDay)
    : undefined;
  const rangeDays = Array.from(
    { length: daysBetween(from, to) + 1 },
    (_, i) => addDays(from, i),
  );
  const closedInRange = state.closings.filter(
    c => c.date >= from && c.date <= to,
  );
  const matchedCount = closedInRange.filter(c => c.status === 'matched').length;
  const reviewCount = closedInRange.length - matchedCount;
  const openCount = rangeDays.filter(d => d <= today).length - closedInRange.length;
  const moneyIn = ledger.filter(e => e.amountCents > 0).reduce((s, e) => s + e.amountCents, 0);
  const moneyOut = ledger.filter(e => e.amountCents < 0).reduce((s, e) => s - e.amountCents, 0);

  return (
    <Screen title="Sales & Closing" subtitle="Record sales, waste and close the day">
      <Notice text={flash} tone="good" />
      <SectionTitle>Quick sale</SectionTitle>
      <QuickSale onDone={setFlash} />
      <Button
        label="Record unsold treat waste"
        icon="🗑"
        variant="secondary"
        onPress={() => setWasteOpen(true)}
      />

      <TaxSummaryPanel />

      <SectionTitle>Choose a day or range</SectionTitle>
      <Choices
        value={custom ? 'custom' : day}
        onChange={v => {
          if (v === 'custom') {
            setCustom({ from: addDays(today, -6), to: today });
          } else {
            setCustom(null);
            setDay(v);
          }
        }}
        options={[
          ...days.map(d => ({ value: d, label: formatDayLabel(d, today) })),
          { value: 'custom', label: 'Custom range' },
        ]}
      />
      {custom ? (
        <CustomRangeFields
          from={custom.from}
          to={custom.to}
          onChange={(f, t) => setCustom({ from: f, to: t })}
        />
      ) : null}

      <Columns>
        <>
      <SectionTitle>Transactions · {periodLabel}</SectionTitle>
      <Card>
        <Stat label="Money in (sales incl. tax)" value={formatCents(moneyIn)} />
        <Stat label="Money out (supplier expenses)" value={moneyOut > 0 ? `−${formatCents(moneyOut)}` : formatCents(0)} />
        {multiDay ? (
          <Row>
            <Body muted>Closings in this range:</Body>
            <Badge tone="good" label={`${matchedCount} matched`} />
            {reviewCount > 0 ? (
              <Badge tone="bad" label={`${reviewCount} need review`} />
            ) : null}
            {openCount > 0 ? (
              <Badge tone="neutral" icon="○" label={`${openCount} not closed`} />
            ) : null}
          </Row>
        ) : (
        <Row>
          <Body muted>Day reconciliation:</Body>
          {closing ? (
            <Badge
              tone={closing.status === 'matched' ? 'good' : 'bad'}
              label={closing.status === 'matched' ? 'Matched' : 'Needs review'}
            />
          ) : (
            <Badge tone="neutral" label="Not closed yet" icon="○" />
          )}
        </Row>
        )}
        <Body muted>
          Payment labels show how something was paid. They do not mean it has
          been verified.
        </Body>
      </Card>
      {ledger.length === 0 ? (
        <Body muted>
          No transactions recorded for {multiDay ? 'this range' : 'this day'}.
        </Body>
      ) : (
        <View style={styles.ledger}>
          {ledger.map((e, i) => (
            <LedgerRow
              key={e.id}
              entry={e}
              divider={i > 0}
              showDate={multiDay}
            />
          ))}
        </View>
      )}
        </>
        <>
      {closingDay ? (
        <>
          <SectionTitle>Closing · {formatDayLabel(closingDay, today)}</SectionTitle>
          {closing ? <ClosingStatus closing={closing} /> : null}
          <ClosingForm
            key={`${closingDay}-${closing?.closedAt ?? 'open'}`}
            day={closingDay}
            saved={closing}
          />
        </>
      ) : (
        <>
          <SectionTitle>Closing</SectionTitle>
          <Card>
            <Body>
              Closing reconciles one day's cash drawer and card terminal, so it
              is done one day at a time. Pick a single day above, or set From
              and To to the same date.
            </Body>
          </Card>
        </>
      )}
        </>
      </Columns>

      <Sheet visible={wasteOpen} title="Record unsold treat waste" onClose={() => setWasteOpen(false)}>
        {wasteOpen ? (
          <TreatWasteForm
            onDone={m => {
              setWasteOpen(false);
              setFlash(m);
            }}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between' },
  total: { fontSize: 24 },
  ledger: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
  },
  ledgerRow: { paddingVertical: 14, gap: 8 },
  ledgerTop: { flexDirection: 'row', gap: 12 },
  ledgerDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  ledgerMain: { flex: 1, gap: 4 },
  amount: { fontSize: 18, fontVariant: ['tabular-nums'] },
});
