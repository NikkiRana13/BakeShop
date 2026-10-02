import React, { useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';
import { DEMO_REPLY } from '../data/demoVendors';
import { ExtractedQuote } from '../logic/quoteParser';
import { recordFollowUp, saveQuote, updateSupplierEmail } from '../logic/vendorActions';
import {
  draftFollowUp,
  EmailDraft,
  formatDistance,
  mailtoUrl,
  QuoteInput,
  quoteImpact,
  savingsPhrase,
} from '../logic/vendors';
import { extractQuote } from '../services/vendorApi';
import { useStore } from '../state/store';
import { colors } from '../theme';
import { PackageUnit, Supplier, VendorPick } from '../types';
import {
  centsToInput,
  formatCents,
  parseDollars,
  parseQuantity,
} from '../utils/format';
import {
  Badge,
  Body,
  Button,
  Card,
  Choices,
  Field,
  Notice,
  Row,
  styles as ui,
} from './ui';

const local = StyleSheet.create({
  multiline: { ...ui.input, minHeight: 180, paddingTop: 12, textAlignVertical: 'top' },
  between: { justifyContent: 'space-between' },
  name: { fontSize: 19 },
  headline: { fontSize: 20 },
  reasons: { gap: 2 },
  draft: { gap: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
});

/**
 * Opens a draft in Grandma's own mail app so it comes from her address and
 * replies come back to her. Where there is no mail app (e.g. a simulator),
 * falls back to the share sheet.
 */
export async function openDraft(draft: EmailDraft): Promise<'mail' | 'share' | 'failed'> {
  try {
    await Linking.openURL(mailtoUrl(draft));
    return 'mail';
  } catch {
    try {
      await Share.share({
        title: draft.subject,
        message: `To: ${draft.to || '(add the address)'}\nSubject: ${draft.subject}\n\n${draft.body}`,
      });
      return 'share';
    } catch {
      return 'failed';
    }
  }
}

export function callVendor(phone: string) {
  Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => {});
}

export function openWebsite(url: string) {
  Linking.openURL(url).catch(() => {});
}

// ------------------------------------------------------------- Pick cards

export function PickCard({
  pick,
  selected,
  onToggle,
}: {
  pick: VendorPick;
  selected: boolean;
  onToggle: () => void;
}) {
  const { lead } = pick;
  const [pitch, ...facts] = pick.reasons;
  return (
    <Card tone={pick.strength === 'local' ? 'good' : 'plain'}>
      <Badge
        tone={pick.strength === 'local' ? 'good' : pick.strength === 'bulk' ? 'warn' : 'info'}
        icon=" "
        label={pick.headline}
      />
      <Body bold style={local.name}>
        {lead.name}
      </Body>
      <Body muted>{lead.address}</Body>
      <Body>{pitch}</Body>
      <View style={local.reasons}>
        {facts.map(f => (
          <Body key={f} muted>
            • {f}
          </Body>
        ))}
      </View>
      {pick.contact === 'email' ? (
        <>
          <Button
            label={selected ? 'Selected for an email' : 'Select to email'}
            icon={selected ? '✓' : '✉'}
            variant={selected ? 'primary' : 'secondary'}
            onPress={onToggle}
          />
          {lead.phone ? (
            <Button
              label={`Call instead (${lead.phone})`}
              icon="📞"
              variant="quiet"
              onPress={() => callVendor(lead.phone!)}
            />
          ) : null}
        </>
      ) : (
        <>
          <Body muted>
            Big chains don't answer price emails. Their prices are online
            or in the weekly flyer.
          </Body>
          {lead.website ? (
            <Button
              label="Check price online"
              icon="🔎"
              variant="secondary"
              onPress={() => openWebsite(lead.website!)}
            />
          ) : null}
          {lead.phone ? (
            <Button
              label={`Call (${lead.phone})`}
              icon="📞"
              variant="quiet"
              onPress={() => callVendor(lead.phone!)}
            />
          ) : null}
        </>
      )}
    </Card>
  );
}

// ------------------------------------------------------------ Email drafts

export function DraftCard({
  supplier,
  initial,
  onOpened,
}: {
  supplier: Supplier;
  initial: EmailDraft;
  onOpened: (to: string) => void;
}) {
  const { run } = useStore();
  const [to, setTo] = useState(initial.to);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [opened, setOpened] = useState<'mail' | 'share' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    if (to.trim() !== (supplier.email ?? '')) {
      const err = run(s => updateSupplierEmail(s, supplier.id, to));
      if (err) {
        return setError(err);
      }
    }
    setError(null);
    const how = await openDraft({ to: to.trim(), subject, body });
    if (how === 'failed') {
      return setError('Could not open your mail app. Copy the text instead.');
    }
    setOpened(how);
    onOpened(to.trim());
  };

  return (
    <View style={[local.draft, local.divider]}>
      <Row style={local.between}>
        <Body bold>{supplier.name}</Body>
        {opened ? <Badge tone="good" label="Opened" /> : null}
      </Row>
      <Field
        label="To"
        value={to}
        onChangeText={setTo}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="their email, from their website"
        hint={to ? undefined : 'No email listed. Check their website, or call instead.'}
      />
      <Field label="Subject" value={subject} onChangeText={setSubject} />
      <Field
        label="Message"
        value={body}
        onChangeText={setBody}
        multiline
        style={local.multiline}
      />
      <Notice text={error} />
      <Button
        label={opened ? 'Open again' : 'Open in Mail'}
        icon="✉"
        variant={opened ? 'secondary' : 'primary'}
        onPress={open}
        accessibilityHint="Opens your own mail app. Nothing is sent until you press Send there."
      />
      {opened === 'mail' ? (
        <Body muted>Press Send in your mail app. Replies come to your inbox as usual.</Body>
      ) : opened === 'share' ? (
        <Body muted>No mail app here, so the text went to the share sheet.</Body>
      ) : null}
    </View>
  );
}

export function FollowUpForm({
  contactId,
  onDone,
}: {
  contactId: string;
  onDone: (message: string) => void;
}) {
  const { state, run } = useStore();
  const contact = state.contacts.find(c => c.id === contactId);
  const supplier = state.suppliers.find(s => s.id === contact?.supplierId);
  if (!contact || !supplier) {
    return <Body>That email could not be found.</Body>;
  }
  const draft = draftFollowUp(state, {
    vendorName: supplier.name,
    vendorEmail: supplier.email,
    ingredientLabel: contact.ingredientLabel,
  });
  return (
    <>
      <Body muted>
        One gentle follow-up, then the app stops asking. If they don't answer
        this one, a phone call usually works better.
      </Body>
      <DraftCard
        supplier={supplier}
        initial={draft}
        onOpened={() => {
          const err = run(s => recordFollowUp(s, contactId));
          if (!err) {
            onDone(`Follow-up to ${supplier.name} opened in your mail app.`);
          }
        }}
      />
    </>
  );
}

// ------------------------------------------------------------ Quote impact

export function QuoteImpactLine({ quote }: { quote: QuoteInput }) {
  const { state } = useStore();
  const impact = quoteImpact(state, quote);
  if (!impact) {
    return (
      <Body muted>
        No batches with this ingredient in the last week, so there is nothing
        to compare against yet.
      </Body>
    );
  }
  const [top, ...rest] = impact.treats;
  const phrase = savingsPhrase(impact.monthlySavingsCents);
  const tone =
    impact.monthlySavingsCents >= 100
      ? 'good'
      : impact.monthlySavingsCents <= -100
      ? 'bad'
      : 'plain';
  return (
    <Card tone={tone}>
      {top ? (
        <Body bold>
          {top.treatName}: {formatCents(top.beforeCents)} →{' '}
          {formatCents(top.afterCents)} per treat
        </Body>
      ) : null}
      <Body bold style={local.headline}>
        {phrase.charAt(0).toUpperCase() + phrase.slice(1)} at your usual volume
      </Body>
      {rest.map(t => (
        <Body key={t.treatId} muted>
          {t.treatName}: {formatCents(t.beforeCents)} → {formatCents(t.afterCents)}
        </Body>
      ))}
      {impact.notes.map(n => (
        <Body key={n} muted>
          {n}
        </Body>
      ))}
    </Card>
  );
}

// ------------------------------------------------------------- Paste reply

function unitOptions(base: 'g' | 'mL' | 'unit'): PackageUnit[] {
  return base === 'g' ? ['kg', 'g'] : base === 'mL' ? ['L', 'mL'] : ['unit'];
}

export function PasteReplyForm({
  supplierId,
  initialIngredientId,
  onDone,
}: {
  supplierId: string;
  initialIngredientId?: string | null;
  onDone: (message: string) => void;
}) {
  const { state, run } = useStore();
  const supplier = state.suppliers.find(s => s.id === supplierId);
  const [ingredientId, setIngredientId] = useState(
    initialIngredientId ?? state.ingredients[0].id,
  );
  const ingredient = state.ingredients.find(i => i.id === ingredientId)!;
  const big = ingredient.unit === 'g' ? 'kg' : ingredient.unit === 'mL' ? 'L' : 'units';
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<{ quote: ExtractedQuote; live: boolean } | null>(null);
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('1');
  const [unit, setUnit] = useState<PackageUnit>(unitOptions(ingredient.unit)[0]);
  const [fee, setFee] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [seasonal, setSeasonal] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!supplier) {
    return <Body>That vendor could not be found.</Body>;
  }

  const read = async () => {
    if (!text.trim()) {
      return setError('Paste the reply first.');
    }
    setError(null);
    setReading(true);
    const res = await extractQuote({
      emailText: text,
      ingredientName: ingredient.name,
      unit: ingredient.unit,
    });
    setReading(false);
    const q = res.data;
    setResult({ quote: q, live: res.live });
    if (q.found) {
      setPrice(q.priceCents ? centsToInput(q.priceCents) : '');
      setSize(q.packageSize ? String(q.packageSize) : '1');
      if (q.packageUnit && unitOptions(ingredient.unit).includes(q.packageUnit)) {
        setUnit(q.packageUnit);
      }
      setFee(q.deliveryFeeCents !== undefined ? centsToInput(q.deliveryFeeCents) : '');
      setMinOrder(
        q.minOrderQty
          ? String(ingredient.unit === 'unit' ? q.minOrderQty : q.minOrderQty / 1000)
          : '',
      );
      setDeliveryNote(q.deliveryNote ?? '');
      setSeasonal(q.seasonalNote ?? '');
    }
  };

  const priceCents = parseDollars(price);
  const sizeNum = parseQuantity(size);
  const feeCents = fee.trim() ? parseDollars(fee) : 0;
  const minNum = minOrder.trim() ? parseQuantity(minOrder) : null;
  const minBase =
    minNum === null ? undefined : ingredient.unit === 'unit' ? minNum : minNum * 1000;
  const preview: QuoteInput | null =
    priceCents && sizeNum && feeCents !== null
      ? {
          ingredientId,
          priceCents,
          packageSize: sizeNum,
          packageUnit: unit,
          deliveryFeeCents: feeCents,
          minOrderQty: minBase,
        }
      : null;

  const save = () => {
    if (!preview) {
      return setError('Enter the price and how much it buys, for example $19 for 5 kg.');
    }
    const err = run(s =>
      saveQuote(s, {
        supplierId,
        ingredientId,
        productName: `${ingredient.name}, ${sizeNum} ${unit}`,
        packageSize: preview.packageSize,
        packageUnit: preview.packageUnit,
        priceCents: preview.priceCents,
        deliveryFeeCents: preview.deliveryFeeCents,
        minOrderQty: preview.minOrderQty,
        deliveryNote,
        seasonalNote: seasonal,
      }),
    );
    if (err) {
      return setError(err);
    }
    onDone(`Saved ${supplier.name}'s quote: ${formatCents(preview.priceCents)} for ${sizeNum} ${unit}.`);
  };

  return (
    <>
      <Choices
        label="Which ingredient is the quote for?"
        value={ingredientId}
        onChange={id => {
          setIngredientId(id);
          const ing = state.ingredients.find(i => i.id === id)!;
          setUnit(unitOptions(ing.unit)[0]);
        }}
        options={state.ingredients.map(i => ({ value: i.id, label: i.name }))}
      />
      <Field
        label={`Paste ${supplier.name}'s reply`}
        value={text}
        onChangeText={setText}
        multiline
        style={local.multiline}
        placeholder="Copy the reply from your email and paste it here"
      />
      <Row>
        <Button
          label={reading ? 'Reading…' : 'Read the price'}
          icon="🔍"
          onPress={read}
          disabled={reading}
        />
        <Button
          label="Use the sample reply"
          variant="quiet"
          onPress={() => setText(DEMO_REPLY)}
        />
      </Row>

      {result ? (
        result.quote.found ? (
          <Card tone="good">
            <Body bold>
              {supplier.name} quoted {price ? `$${price}` : 'a price'} for {size} {unit}
              {deliveryNote ? `, ${deliveryNote.toLowerCase()}` : ''}. Save this?
            </Body>
            <Body muted>
              {result.quote.note ?? 'Check it against the email before saving.'}
              {result.live ? '' : ' (Read on this phone, without the server.)'}
            </Body>
          </Card>
        ) : (
          <Card tone="warn">
            <Body bold>Couldn't find a clear price</Body>
            <Body>{result.quote.note ?? 'Read their reply and enter the price yourself.'}</Body>
            <Body muted>“{text.trim()}”</Body>
          </Card>
        )
      ) : null}

      {result ? (
        <>
          <Field
            label="Quoted price ($)"
            keyboardType="decimal-pad"
            value={price}
            onChangeText={setPrice}
            placeholder="e.g. 19.00"
          />
          <Field
            label="For how much"
            keyboardType="decimal-pad"
            value={size}
            onChangeText={setSize}
          />
          <Choices
            label="Unit"
            value={unit}
            onChange={setUnit}
            options={unitOptions(ingredient.unit).map(u => ({ value: u, label: u }))}
          />
          <Field
            label="Delivery fee per order ($)"
            keyboardType="decimal-pad"
            value={fee}
            onChangeText={setFee}
            placeholder="0 if pickup or free"
          />
          <Field
            label={`Minimum order (${big}, optional)`}
            keyboardType="decimal-pad"
            value={minOrder}
            onChangeText={setMinOrder}
          />
          <Field label="Delivery days (optional)" value={deliveryNote} onChangeText={setDeliveryNote} />
          <Field
            label="Seasonal price note (optional)"
            value={seasonal}
            onChangeText={setSeasonal}
            placeholder="e.g. about 10% higher in winter"
          />
          {preview ? <QuoteImpactLine quote={preview} /> : null}
          <Notice text={error} />
          <Button label="Save quote" icon="✓" onPress={save} />
        </>
      ) : (
        <Notice text={error} />
      )}
    </>
  );
}

export function leadLine(name: string, km: number, chain: boolean): string {
  return `${name} · ${formatDistance(km)}${chain ? ' · chain' : ''}`;
}
