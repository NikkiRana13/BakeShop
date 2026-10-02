import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Badge,
  Body,
  Button,
  Card,
  Choices,
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
  sellTreat,
  wasteTreat,
} from '../logic/actions';
import { dayTotals, finishedStock, ledgerForDay } from '../logic/selectors';
import { DEFAULT_FLOAT_CENTS } from '../data/seed';
import { useNav } from '../navigation';
import { useStore } from '../state/store';
import { Closing, SalePayment } from '../types';
import { colors } from '../theme';
import {
  addDays,
  centsToInput,
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

function QuickSale({ onDone }: { onDone: (m: string) => void }) {
  const { state, run } = useStore();
  const [treatId, setTreatId] = useState(state.treats[0].id);
  const [qty, setQty] = useState(1);
  const [payment, setPayment] = useState<SalePayment>('cash');
  const [error, setError] = useState<string | null>(null);
  const treat = state.treats.find(t => t.id === treatId)!;
  const stock = finishedStock(state, treatId);
  const over = qty > stock;

  const save = () => {
    const err = run(s => sellTreat(s, treatId, qty, payment));
    if (err) {
      return setError(err);
    }
    setError(null);
    onDone(
      `Sold ${qty} ${treat.name} for ${formatCents(
        treat.priceCents * qty,
      )} (${payment}). ${stock - qty} left.`,
    );
    setQty(1);
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
          detail: `${formatCents(t.priceCents)} · ${finishedStock(
            state,
            t.id,
          )} ready`,
        }))}
      />
      <Stepper label="Quantity" value={qty} onChange={setQty} max={99} />
      <Choices
        label="Payment"
        value={payment}
        onChange={setPayment}
        options={[
          { value: 'cash', label: 'Cash' },
          { value: 'card', label: 'Card' },
        ]}
      />
      <Row style={styles.between}>
        <Body>Total</Body>
        <Body bold style={styles.total}>
          {formatCents(treat.priceCents * qty)}
        </Body>
      </Row>
      {stock === 0 ? (
        <Notice text={`No ${treat.name} ready. Record a batch on the Inventory tab first.`} />
      ) : over ? (
        <Notice text={`Only ${stock} ready to sell.`} />
      ) : null}
      <Notice text={error} />
      <Button label="Save sale" icon="✓" onPress={save} disabled={over || stock === 0} />
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
      <Stat label="Expected cash sales" value={formatCents(totals.cashSalesCents)} />
      <Stat label="Expected card sales" value={formatCents(totals.cardSalesCents)} />
      <Field
        label="Opening cash float ($)"
        keyboardType="decimal-pad"
        value={float}
        onChangeText={setFloat}
      />
      <Stat label="Recorded cash expenses" value={`−${formatCents(totals.cashExpensesCents)}`} />
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

export function SalesScreen() {
  const { state } = useStore();
  const nav = useNav();
  const today = todayKey();
  const [day, setDay] = useState(today);
  const [flash, setFlash] = useState<string | null>(null);
  const [wasteOpen, setWasteOpen] = useState(false);

  useEffect(() => {
    if (nav.intent?.kind === 'closing') {
      setDay(nav.intent.day);
      nav.clearIntent();
    }
  }, [nav]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  const ledger = ledgerForDay(state, day);
  const closing = state.closings.find(c => c.date === day);
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

      <SectionTitle>Choose a day</SectionTitle>
      <Choices
        value={day}
        onChange={setDay}
        options={days.map(d => ({ value: d, label: formatDayLabel(d, today) }))}
      />

      <SectionTitle>Transactions · {formatDayLabel(day, today)}</SectionTitle>
      <Card>
        <Stat label="Money in (sales)" value={formatCents(moneyIn)} />
        <Stat label="Money out (supplier expenses)" value={`−${formatCents(moneyOut)}`} />
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
        <Body muted>
          Payment labels show how something was paid. They do not mean it has
          been verified.
        </Body>
      </Card>
      {ledger.length === 0 ? (
        <Body muted>No transactions recorded for this day.</Body>
      ) : (
        <View style={styles.ledger}>
          {ledger.map((e, i) => (
            <View
              key={e.id}
              style={[styles.ledgerRow, i > 0 && styles.ledgerDivider]}>
              <View style={styles.ledgerMain}>
                <Body bold>{e.description}</Body>
                <Body muted>
                  {formatTime(e.dateTime)} · {e.category}
                </Body>
                <Row>
                  <Badge
                    tone={e.payment === 'unpaid' ? 'warn' : 'neutral'}
                    icon={e.payment === 'unpaid' ? '!' : e.payment === 'cash' ? '$' : '▭'}
                    label={PAYMENT_LABEL[e.payment]}
                  />
                </Row>
              </View>
              <Body
                bold
                style={[styles.amount, { color: e.amountCents < 0 ? colors.red : colors.green }]}>
                {e.amountCents > 0 ? '+' : ''}
                {formatCents(e.amountCents)}
              </Body>
            </View>
          ))}
        </View>
      )}

      <SectionTitle>Closing · {formatDayLabel(day, today)}</SectionTitle>
      {closing ? <ClosingStatus closing={closing} /> : null}
      <ClosingForm key={`${day}-${closing?.closedAt ?? 'open'}`} day={day} saved={closing} />

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
  ledgerRow: { flexDirection: 'row', paddingVertical: 14, gap: 12 },
  ledgerDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  ledgerMain: { flex: 1, gap: 4 },
  amount: { fontSize: 18, fontVariant: ['tabular-nums'] },
});
