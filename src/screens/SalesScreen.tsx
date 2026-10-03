import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  CustomRangeFields,
  rangeLabel,
} from '../components/DateRangePicker';
import { Icon } from '../components/Icon';
import {
  BreakdownAmounts,
  FirstNationsReliefForm,
  TaxBreakdownView,
  TaxSummaryPanel,
} from '../components/SalesTax';
import { TreatPerformance } from '../components/TreatPerformance';
import {
  Badge,
  Body,
  Button,
  Card,
  Choices,
  Columns,
  Disclosure,
  Field,
  Notice,
  Row,
  Screen,
  SectionTitle,
  Sheet,
  Stat,
  Stepper,
} from '../components/ui';
import { DEFAULT_FLOAT_CENTS } from '../data/seed';
import {
  closeDay,
  computeClosing,
  previewSaleTax,
  sellTreat,
  wasteTreat,
} from '../logic/actions';
import {
  dayTotals,
  finishedStock,
  LedgerEntry,
  ledgerForRange,
} from '../logic/selectors';
import { Fulfilment } from '../logic/tax';
import { costAdvice } from '../logic/vendors';
import { useNav } from '../navigation';
import { useStore } from '../state/store';
import { colors, font, fontFamily, radius } from '../theme';
import { Closing, ReliefConfirmation, SalePayment } from '../types';
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
  const [wasteOpen, setWasteOpen] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const treat = state.treats.find(t => t.id === treatId)!;
  const stock = finishedStock(state, treatId);
  const over = qty > stock;
  const tax = previewSaleTax(state, treatId, qty, fulfilment, relief !== null);
  const b = tax.ok ? tax.breakdown : null;
  const rebates = b ? b.preparedFoodRebateCents + b.firstNationsRebateCents : 0;

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
    <View style={styles.quick}>
      <Text style={styles.h2} accessibilityRole="header">
        Quick sale
      </Text>
      <Choices
        label="Treat"
        stacked
        value={treatId}
        onChange={id => {
          setTreatId(id);
          setQty(1);
          setError(null);
        }}
        options={state.treats.map(t => ({
          value: t.id,
          label: t.name,
          detail: `${formatCents(t.priceCents)} · ${finishedStock(
            state,
            t.id,
          )} ready`,
        }))}
      />
      <Stepper label="How many" value={qty} onChange={setQty} max={99} />
      <Choices
        label="Where will they eat it?"
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
        <View style={styles.reliefOn}>
          <Badge tone="good" label="First Nations relief confirmed (demo record)" />
          <Button
            label="Remove relief"
            variant="quiet"
            onPress={() => setRelief(null)}
          />
        </View>
      ) : (
        <Button
          label="First Nations tax relief"
          variant="quiet"
          onPress={() => setReliefOpen(true)}
          accessibilityHint="Opens a confirmation form. Does not save the sale."
        />
      )}
      {b ? (
        <View style={styles.totals}>
          <Stat label="Price before tax" value={formatCents(b.subtotalCents)} />
          <Stat
            label={rebates > 0 ? 'HST before rebates' : 'HST (13%)'}
            value={formatCents(b.taxBeforeRebatesCents)}
          />
          {b.preparedFoodRebateCents > 0 ? (
            <Stat
              label="Prepared-food rebate"
              value={`−${formatCents(b.preparedFoodRebateCents)}`}
            />
          ) : null}
          {b.firstNationsRebateCents > 0 ? (
            <Stat
              label="First Nations rebate"
              value={`−${formatCents(b.firstNationsRebateCents)}`}
            />
          ) : null}
          {rebates > 0 ? (
            <Stat label="Tax charged" value={formatCents(b.taxChargedCents)} />
          ) : null}
          <View style={styles.rule} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCents(b.totalCents)}</Text>
          </View>
          {b.notes.map(n => (
            <Body key={n} muted>
              {n}
            </Body>
          ))}
        </View>
      ) : (
        <Notice text={tax.ok ? null : tax.error} />
      )}
      {stock === 0 ? (
        <Notice text={`No ${treat.name} ready. Record a batch on the Inventory page first.`} />
      ) : over ? (
        <Notice text={`Only ${stock} ready to sell.`} />
      ) : null}
      <Notice text={error} />
      <Button
        label={b ? `Save sale · ${formatCents(b.totalCents)}` : 'Save sale'}
        onPress={save}
        disabled={over || stock === 0 || !tax.ok}
      />
      <Button
        label="Record unsold treat waste"
        variant="quiet"
        icon="trash"
        onPress={() => setWasteOpen(true)}
      />
      {receipt ? (
        <Card>
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
      <Sheet
        visible={wasteOpen}
        title="Record unsold treat waste"
        onClose={() => setWasteOpen(false)}>
        {wasteOpen ? (
          <TreatWasteForm
            onDone={m => {
              setWasteOpen(false);
              onDone(m);
            }}
          />
        ) : null}
      </Sheet>
    </View>
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
        stacked
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
        label="Servings thrown away"
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
        icon="trash"
        onPress={save}
        disabled={stock === 0 || qty > stock}
      />
    </>
  );
}

function describeDiff(diff: number, what: string): string {
  return Math.abs(diff) <= 1
    ? `${what}: matched`
    : `${what}: ${diff < 0 ? 'short' : 'over'} by ${formatCents(Math.abs(diff))}`;
}

function ClosingStatus({ closing }: { closing: Closing }) {
  const matched = closing.status === 'matched';
  return (
    <Card tone={matched ? 'good' : 'bad'}>
      <Badge
        tone={matched ? 'good' : 'bad'}
        label={matched ? 'Matched' : 'Needs review'}
      />
      <Body>{describeDiff(closing.cashDiffCents, 'Cash drawer')}</Body>
      <Body>{describeDiff(closing.cardDiffCents, 'Card machine')}</Body>
      <Body muted>
        Closed {formatDate(closing.date)} at {formatTime(closing.closedAt)}
      </Body>
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
      return setError('Enter the starting cash, cash counted and card machine total, e.g. 125.50.');
    }
    const err = run(s =>
      closeDay(s, computeClosing(s, day, floatCents, cashCents, terminalCents)),
    );
    setError(err);
  };

  const diffText = (d: number) =>
    Math.abs(d) <= 1 ? `${formatCents(d)} (matched)` : `${d > 0 ? '+' : ''}${formatCents(d)}`;

  return (
    <>
      <Badge tone="neutral" icon="receipt" label="Daily aggregate reconciliation" />
      <Body muted>
        This compares the day’s totals only. Each sale is not checked on its
        own.
      </Body>
      <Stat
        label="Cash sales, including tax"
        value={formatCents(totals.cashSalesCents)}
      />
      <Stat
        label="Card sales, including tax"
        value={formatCents(totals.cardSalesCents)}
      />
      <Field
        label="Starting cash in the drawer ($)"
        keyboardType="decimal-pad"
        value={float}
        onChangeText={setFloat}
      />
      <Stat
        label="Cash spent on supplies"
        value={
          totals.cashExpensesCents > 0
            ? `−${formatCents(totals.cashExpensesCents)}`
            : formatCents(0)
        }
      />
      <Stat label="Cash drawer should have" value={formatCents(expectedDrawer)} strong />
      <Field
        label="Cash you counted ($)"
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
        hint="Use the card machine’s gross sales total for the day, not the bank deposit."
      />
      {preview ? (
        <>
          <Stat label="Cash difference" value={diffText(preview.cashDiffCents)} strong />
          <Stat label="Card difference" value={diffText(preview.cardDiffCents)} strong />
        </>
      ) : null}
      {totals.cardExpensesCents > 0 ? (
        <Body muted>
          Card payments to suppliers ({formatCents(totals.cardExpensesCents)})
          are kept separate and are not part of the card machine check.
        </Body>
      ) : null}
      <Notice text={error} />
      <Button label={saved ? 'Close the day again' : 'Close the day'} onPress={submit} />
    </>
  );
}

/** Today's closing summary: what to expect, with the math behind a toggle. */
function TodayClosing({
  onClose,
  onReview,
}: {
  onClose: (day: string) => void;
  onReview: (day: string) => void;
}) {
  const { state } = useStore();
  const today = todayKey();
  const [math, setMath] = useState(false);
  const saved = state.closings.find(c => c.date === today);
  const totals = dayTotals(state, today);
  const float = saved?.openingFloatCents ?? DEFAULT_FLOAT_CENTS;
  const drawer = float + totals.cashSalesCents - totals.cashExpensesCents;
  const yesterday = state.closings.find(
    c => c.date === addDays(today, -1) && c.status === 'needs_review',
  );
  return (
    <View style={styles.closing}>
      <Text style={styles.h2} accessibilityRole="header">
        Today’s closing
      </Text>
      {saved ? (
        <Badge
          tone={saved.status === 'matched' ? 'good' : 'bad'}
          label={saved.status === 'matched' ? 'Matched' : 'Needs review'}
        />
      ) : (
        <Badge tone="neutral" icon="circle" label="Not closed yet" />
      )}
      <View style={styles.bigStat}>
        <Text style={styles.bigLabel}>Cash drawer should have</Text>
        <Text style={styles.bigValue}>{formatCents(drawer)}</Text>
      </View>
      <View style={styles.bigStat}>
        <Text style={styles.bigLabel}>Card machine should show</Text>
        <Text style={styles.bigValue}>{formatCents(totals.cardSalesCents)}</Text>
      </View>
      {saved ? (
        <>
          <Body>{describeDiff(saved.cashDiffCents, 'Cash drawer')}</Body>
          <Body>{describeDiff(saved.cardDiffCents, 'Card machine')}</Body>
        </>
      ) : (
        <Body>Count the cash drawer, then enter what you find.</Body>
      )}
      <Button
        label={saved ? 'Close the day again' : 'Close the day'}
        onPress={() => onClose(today)}
      />
      <Disclosure
        open={math}
        onToggle={() => setMath(m => !m)}
        openLabel="Hide the math"
        closedLabel="See the math"
      />
      {math ? (
        <View style={styles.math}>
          <Body>
            Starting cash {formatCents(float)} + cash sales{' '}
            {formatCents(totals.cashSalesCents)} − cash spent{' '}
            {formatCents(totals.cashExpensesCents)} ={' '}
            <Text style={styles.strong}>{formatCents(drawer)}</Text>
          </Body>
          <Body>
            Card sales including tax ={' '}
            <Text style={styles.strong}>{formatCents(totals.cardSalesCents)}</Text>
          </Body>
          {totals.cardExpensesCents > 0 ? (
            <Body>
              Card payments to suppliers ({formatCents(totals.cardExpensesCents)})
              are kept separate.
            </Body>
          ) : null}
          <Body>This checks the day’s totals only, not each sale.</Body>
        </View>
      ) : null}
      {yesterday ? (
        <View style={styles.yesterday}>
          <Icon name="alert" size={32} color={colors.accent} />
          <View style={styles.yesterdayText}>
            <Body>
              <Text style={styles.strong}>Yesterday needs review.</Text>{' '}
              {describeDiff(yesterday.cashDiffCents, 'Cash drawer')}.
            </Body>
            <Button
              label="Review yesterday"
              variant="quiet"
              onPress={() => onReview(yesterday.date)}
            />
          </View>
        </View>
      ) : null}
    </View>
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
              icon={e.payment === 'unpaid' ? 'alert' : e.payment === 'cash' ? 'coins' : 'receipt'}
              label={PAYMENT_LABEL[e.payment]}
            />
            {sale && sale.firstNationsRebateCents > 0 ? (
              <Badge tone="info" icon="check" label="First Nations rebate" />
            ) : null}
          </Row>
        </View>
        <Text
          style={[
            styles.amount,
            { color: e.amountCents < 0 ? colors.accent : colors.green },
          ]}>
          {e.amountCents > 0 ? '+' : ''}
          {formatCents(e.amountCents)}
        </Text>
      </View>
      {sale ? (
        <>
          <Disclosure
            open={open}
            onToggle={() => setOpen(o => !o)}
            openLabel="Hide sale details"
            closedLabel="Sale details"
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

/** Ingredients that take the biggest share of spending, with a way to shop around. */
function CostTips() {
  const { state } = useStore();
  const nav = useNav();
  const tips = costAdvice(state, todayKey());
  if (tips.length === 0) {
    return null;
  }
  return (
    <View style={styles.txSection}>
      <SectionTitle>Where your money goes</SectionTitle>
      {tips.map(tip => (
        <Card key={tip.id} tone="warm">
          <Badge tone="warn" icon="coins" label="Biggest cost" />
          <Text style={styles.tipTitle}>{tip.title}</Text>
          <Body>{tip.body}</Body>
          <Button
            label="See other options"
            icon="store"
            variant="secondary"
            onPress={() =>
              nav.go('inventory', {
                kind: 'research',
                ingredientId: tip.ingredientId,
              })
            }
          />
        </Card>
      ))}
    </View>
  );
}

/** Transactions for a day or range, plus each day's closing status. */
function Transactions({ onClose }: { onClose: (day: string) => void }) {
  const { state } = useStore();
  const today = todayKey();
  const [day, setDay] = useState(today);
  // A custom range applies to the list; closing stays per day.
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(
    null,
  );
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  const from = custom?.from ?? day;
  const to = custom?.to ?? day;
  const multiDay = from !== to;
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
    <>
      <Choices
        label="Choose a day or range"
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
      <Text style={styles.h3}>Transactions · {periodLabel}</Text>
      <Card>
        <Stat label="Money in (sales, including tax)" value={formatCents(moneyIn)} />
        <Stat
          label="Money out (supplier costs)"
          value={moneyOut > 0 ? `−${formatCents(moneyOut)}` : formatCents(0)}
        />
        {multiDay ? (
          <Row>
            <Badge tone="good" label={`${matchedCount} days matched`} />
            {reviewCount > 0 ? (
              <Badge tone="bad" label={`${reviewCount} need review`} />
            ) : null}
            {openCount > 0 ? (
              <Badge tone="neutral" icon="circle" label={`${openCount} not closed`} />
            ) : null}
          </Row>
        ) : (
          <Row>
            {closing ? (
              <Badge
                tone={closing.status === 'matched' ? 'good' : 'bad'}
                label={closing.status === 'matched' ? 'Closing matched' : 'Closing needs review'}
              />
            ) : (
              <Badge tone="neutral" icon="circle" label="Not closed yet" />
            )}
            {closingDay ? (
              <Button
                label={closing ? 'See this closing' : 'Close this day'}
                variant="secondary"
                onPress={() => onClose(closingDay)}
              />
            ) : null}
          </Row>
        )}
        <Body muted>
          Payment labels show how something was paid. They do not mean it has
          been checked.
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
  );
}

export function SalesScreen() {
  const { state } = useStore();
  const nav = useNav();
  const today = todayKey();
  const [flash, setFlash] = useState<string | null>(null);
  const [closingDay, setClosingDay] = useState<string | null>(null);
  const [txOpen, setTxOpen] = useState(false);

  useEffect(() => {
    if (nav.intent?.kind === 'closing') {
      setClosingDay(nav.intent.day);
      nav.clearIntent();
    }
  }, [nav]);

  const sheetClosing = closingDay
    ? state.closings.find(c => c.date === closingDay)
    : undefined;

  return (
    <Screen
      title="Sales"
      subtitle="Sell a treat, close the day, and see what is working.">
      <Notice text={flash} tone="good" />
      <Columns weights={[1.2, 1]}>
        <QuickSale onDone={setFlash} />
        <TodayClosing onClose={setClosingDay} onReview={setClosingDay} />
      </Columns>

      <TaxSummaryPanel />

      <TreatPerformance />

      <CostTips />

      <View style={styles.txSection}>
        <View style={styles.txHead}>
          <SectionTitle>Transactions and past closings</SectionTitle>
          <Disclosure
            open={txOpen}
            onToggle={() => setTxOpen(o => !o)}
            openLabel="Hide"
            closedLabel="Show"
          />
        </View>
        {txOpen ? <Transactions onClose={setClosingDay} /> : null}
      </View>

      <Sheet
        visible={closingDay !== null}
        title={
          closingDay
            ? `Closing · ${formatDayLabel(closingDay, today)}`
            : 'Closing'
        }
        onClose={() => setClosingDay(null)}>
        {closingDay ? (
          <>
            {sheetClosing ? <ClosingStatus closing={sheetClosing} /> : null}
            <ClosingForm
              key={`${closingDay}-${sheetClosing?.closedAt ?? 'open'}`}
              day={closingDay}
              saved={sheetClosing}
            />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h2: {
    fontFamily: fontFamily.display,
    fontSize: font.heading,
    fontWeight: '600',
    color: colors.text,
  },
  h3: {
    fontFamily: fontFamily.display,
    fontSize: font.subheading,
    fontWeight: '600',
    color: colors.text,
  },
  strong: { fontWeight: '700' },
  quick: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: 28,
    gap: 22,
  },
  reliefOn: { gap: 8 },
  totals: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: 22,
    paddingVertical: 20,
    gap: 6,
  },
  rule: { height: 2, backgroundColor: colors.divider, marginVertical: 6 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  totalLabel: {
    fontFamily: fontFamily.body,
    fontSize: font.body,
    fontWeight: '600',
    color: colors.text,
  },
  totalValue: {
    fontFamily: fontFamily.body,
    fontSize: 44,
    fontWeight: '700',
    color: colors.text,
  },
  closing: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 28,
    gap: 20,
  },
  bigStat: { gap: 4 },
  bigLabel: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    fontWeight: '500',
    color: colors.muted,
  },
  bigValue: {
    fontFamily: fontFamily.body,
    fontSize: font.number,
    fontWeight: '700',
    color: colors.text,
  },
  math: {
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    padding: 20,
    gap: 10,
  },
  yesterday: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderTopWidth: 2,
    borderTopColor: colors.divider,
    paddingTop: 18,
  },
  yesterdayText: { flex: 1, gap: 4 },
  txSection: { gap: 20 },
  tipTitle: {
    fontFamily: fontFamily.body,
    fontSize: font.subheading,
    fontWeight: '700',
    color: colors.text,
  },
  txHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ledger: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 24,
  },
  ledgerRow: { paddingVertical: 18, gap: 8 },
  ledgerTop: { flexDirection: 'row', gap: 16 },
  ledgerDivider: { borderTopWidth: 2, borderTopColor: colors.divider },
  ledgerMain: { flex: 1, gap: 6 },
  amount: {
    fontFamily: fontFamily.body,
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
