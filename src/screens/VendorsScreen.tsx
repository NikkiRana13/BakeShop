import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  callVendor,
  DraftCard,
  FollowUpForm,
  leadLine,
  openWebsite,
  PasteReplyForm,
  PickCard,
  QuoteImpactLine,
} from '../components/VendorForms';
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
} from '../components/ui';
import { isChain } from '../logic/chains';
import {
  recordEmailSent,
  saveResearch,
  saveVendorFromLead,
  supplierIdForLead,
} from '../logic/vendorActions';
import {
  ContactStage,
  contactStage,
  draftQuoteEmail,
  formatDistance,
  pickStrongChoices,
  weeklyUsage,
} from '../logic/vendors';
import { useNav } from '../navigation';
import { findVendors, researchIngredient } from '../services/vendorApi';
import { useStore } from '../state/store';
import { font } from '../theme';
import { MarketType, Supplier, VendorContact, VendorLead } from '../types';
import { formatCents, formatDate, makeId, todayKey } from '../utils/format';

const NEW_INGREDIENT = 'new';

type SheetState =
  | { kind: 'drafts'; supplierIds: string[]; ingredientId: string | null; label: string }
  | { kind: 'reply'; supplierId: string; ingredientId: string | null }
  | { kind: 'followup'; contactId: string };

const SHEET_TITLES: Record<SheetState['kind'], string> = {
  drafts: 'Email drafts',
  reply: 'Add their reply',
  followup: 'One gentle follow-up',
};

interface Shown {
  query: string;
  ingredientId: string | null;
  types: MarketType[] | null;
  typesLive: boolean;
  leads: VendorLead[] | null;
  leadsLive: boolean;
}

const STAGE_TEXT: Record<ContactStage, (c: VendorContact) => string> = {
  waiting: c => `Emailed ${formatDate(c.sentOn)} about ${c.ingredientLabel.toLowerCase()} · waiting for a reply`,
  follow_up_due: c => `No reply since ${formatDate(c.sentOn)}. Send one gentle follow-up?`,
  waiting_after_follow_up: c => `Followed up ${formatDate(c.followUpOn!)} · waiting`,
  replied: c => `Replied ${formatDate(c.repliedOn!)}`,
  no_reply: () => 'No reply. Many small shops prefer a phone call.',
};

function VendorCard({
  supplier,
  onEmail,
  onReply,
  onFollowUp,
}: {
  supplier: Supplier;
  onEmail: () => void;
  onReply: (ingredientId: string | null) => void;
  onFollowUp: (contactId: string) => void;
}) {
  const { state } = useStore();
  const today = todayKey();
  const latest = state.contacts
    .filter(c => c.supplierId === supplier.id)
    .sort((a, b) => b.sentOn.localeCompare(a.sentOn))[0];
  const stage = latest ? contactStage(latest, today) : null;
  const quotes = state.offers.filter(
    o => o.supplierId === supplier.id && o.source === 'quote',
  );
  return (
    <Card>
      <Row style={styles.between}>
        <Body bold style={styles.name}>
          {supplier.name}
        </Body>
        <Badge
          tone={supplier.isChain ? 'neutral' : 'good'}
          icon={supplier.isChain ? 'store' : 'leaf'}
          label={supplier.isChain ? 'Chain' : 'Local'}
        />
      </Row>
      {supplier.address ? (
        <Body muted>
          {supplier.address}
          {supplier.distanceKm !== undefined ? ` · ${formatDistance(supplier.distanceKm)}` : ''}
        </Body>
      ) : null}
      {latest && stage ? (
        <Badge
          tone={stage === 'follow_up_due' ? 'warn' : stage === 'replied' ? 'good' : 'neutral'}
          icon={stage === 'replied' ? 'check' : 'mail'}
          label={STAGE_TEXT[stage](latest)}
        />
      ) : null}
      {quotes.map(q => {
        const ing = state.ingredients.find(i => i.id === q.ingredientId);
        return (
          <View key={q.id} style={styles.quote}>
            <Body bold>
              {ing?.name}: {formatCents(q.priceCents)} for {q.packageSize} {q.packageUnit}
            </Body>
            <Body muted>
              Quoted {q.quotedOn ? formatDate(q.quotedOn) : ''}
              {q.deliveryNote ? ` · ${q.deliveryNote}` : ''}
              {supplier.deliveryFeeCents > 0
                ? ` · ${formatCents(supplier.deliveryFeeCents)} delivery`
                : ''}
            </Body>
            {q.seasonalNote ? <Body muted>Seasonal: {q.seasonalNote}</Body> : null}
            <QuoteImpactLine
              quote={{
                ingredientId: q.ingredientId,
                priceCents: q.priceCents,
                packageSize: q.packageSize,
                packageUnit: q.packageUnit,
                deliveryFeeCents: supplier.deliveryFeeCents,
                minOrderQty: q.minOrderQty,
              }}
            />
          </View>
        );
      })}
      {stage === 'follow_up_due' && latest ? (
        <Button
          label="Send one follow-up"
          icon="mail"
          onPress={() => onFollowUp(latest.id)}
        />
      ) : null}
      <View style={styles.grid}>
        {!supplier.isChain ? (
          <Button
            style={styles.gridBtn}
            label="Email"
            icon="mail"
            variant="secondary"
            onPress={onEmail}
          />
        ) : null}
        {supplier.phone ? (
          <Button
            style={styles.gridBtn}
            label="Call"
            icon="phone"
            variant="secondary"
            onPress={() => callVendor(supplier.phone!)}
          />
        ) : null}
        {supplier.isChain && supplier.website ? (
          <Button
            style={styles.gridBtn}
            label="Check price online"
            icon="search"
            variant="secondary"
            onPress={() => openWebsite(supplier.website!)}
          />
        ) : null}
        <Button
          style={styles.gridBtn}
          label="Add their reply"
          icon="inbox"
          variant="quiet"
          onPress={() => onReply(latest?.ingredientId ?? null)}
        />
      </View>
    </Card>
  );
}

/** Vendor search: a sub-page of Inventory in Pantry's three-section layout. */
export function VendorsScreen({ onBack }: { onBack: () => void }) {
  const { state, run } = useStore();
  const nav = useNav();
  const today = todayKey();
  const latestRun = state.research[0];
  const [query, setQuery] = useState('');
  const [reason, setReason] = useState('');
  const [replaces, setReplaces] = useState<string>(NEW_INGREDIENT);
  const [shown, setShown] = useState<Shown | null>(null);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [sheetKey, setSheetKey] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Without a fresh search, show the last saved one.
  const view: Shown | null =
    shown ??
    (latestRun
      ? {
          query: latestRun.query,
          ingredientId: latestRun.ingredientId,
          types: latestRun.types,
          typesLive: latestRun.live,
          leads: latestRun.vendors,
          leadsLive: latestRun.live,
        }
      : null);

  const open = (s: SheetState) => {
    setSheetKey(k => k + 1);
    setSheet(s);
  };

  const search = useCallback(
    async (q: string, ingredientId: string | null, why: string) => {
      const text = q.trim();
      if (!text) {
        setError('Type the ingredient you are thinking about, for example "oat milk".');
        return;
      }
      setError(null);
      setFlash(null);
      setSelected([]);
      setShowAll(false);
      setShown({ query: text, ingredientId, types: null, typesLive: false, leads: null, leadsLive: false });
      setLoadingTypes(true);
      setLoadingLeads(true);
      const profile = state.profile;
      // Both lookups run at once; each section appears as soon as it is ready.
      const leadsP = findVendors({ query: text, profile }).then(res => {
        if (mounted.current) {
          setShown(s => (s ? { ...s, leads: res.data, leadsLive: res.live } : s));
          setLoadingLeads(false);
        }
        return res;
      });
      const typesP = researchIngredient({ query: text, reason: why || undefined, profile }).then(
        res => {
          if (mounted.current) {
            setShown(s => (s ? { ...s, types: res.data, typesLive: res.live } : s));
            setLoadingTypes(false);
          }
          return res;
        },
      );
      const [leads, types] = await Promise.all([leadsP, typesP]);
      run(s =>
        saveResearch(s, {
          id: makeId('research'),
          query: text,
          reason: why || undefined,
          ingredientId,
          ranAt: new Date().toISOString(),
          live: leads.live && types.live,
          types: types.data,
          vendors: leads.data,
        }),
      );
    },
    [run, state.profile],
  );

  // "See other options" (Sales or Inventory) arrives here with an ingredient.
  useEffect(() => {
    const intent = nav.intent;
    if (intent && intent.kind === 'research') {
      nav.clearIntent();
      const ing = state.ingredients.find(i => i.id === intent.ingredientId);
      const q = intent.query ?? ing?.name ?? '';
      setQuery(q);
      setReplaces(ing?.id ?? NEW_INGREDIENT);
      if (q) {
        search(q, ing?.id ?? null, '');
      }
    }
  }, [nav, search, state.ingredients]);

  const picks = view?.leads ? pickStrongChoices(view.leads) : [];
  const emailPicks = picks.filter(p => p.contact === 'email' && selected.includes(p.lead.placeId));

  const draftSelected = () => {
    if (!view) {
      return;
    }
    for (const p of emailPicks) {
      run(s => saveVendorFromLead(s, p.lead, p.isChain));
    }
    open({
      kind: 'drafts',
      supplierIds: emailPicks.map(p => supplierIdForLead(p.lead)),
      ingredientId: view.ingredientId,
      label: view.query,
    });
  };

  const myVendors = state.suppliers.filter(
    s =>
      s.placeId ||
      state.contacts.some(c => c.supplierId === s.id) ||
      state.offers.some(o => o.supplierId === s.id && o.source === 'quote'),
  );

  const done = (message: string) => {
    setSheet(null);
    setFlash(message);
  };

  return (
    <Screen
      title="Find vendors"
      subtitle="Find a new or cheaper ingredient nearby.">
      <Button
        label="Back to inventory"
        icon="chevronLeft"
        variant="quiet"
        onPress={onBack}
      />
      <Notice text={flash} tone="good" />
      <Card>
        <Field
          label="I'm thinking about…"
          value={query}
          onChangeText={setQuery}
          placeholder='e.g. "oat milk" or "cheaper vanilla"'
          returnKeyType="search"
          onSubmitEditing={() =>
            search(query, replaces === NEW_INGREDIENT ? null : replaces, reason)
          }
        />
        <Field
          label="Why? (optional)"
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. for a dairy-free parfait"
        />
        <Choices
          label="Would it replace something you use?"
          value={replaces}
          onChange={setReplaces}
          options={[
            ...state.ingredients.map(i => ({ value: i.id, label: i.name })),
            { value: NEW_INGREDIENT, label: 'New ingredient' },
          ]}
        />
        <Notice text={error} />
        <Button
          label={loadingLeads || loadingTypes ? 'Searching…' : 'Find vendors'}
          icon="search"
          disabled={loadingLeads || loadingTypes}
          onPress={() => search(query, replaces === NEW_INGREDIENT ? null : replaces, reason)}
        />
      </Card>

      {view ? (
        <>
          <SectionTitle>Types on the market</SectionTitle>
          {view.types === null ? (
            <Card>
              <Body muted>Looking up what people say… this can take up to half a minute.</Body>
            </Card>
          ) : (
            <Card>
              {!view.typesLive ? (
                <Badge tone="warn" label="Sample results (no live search)" />
              ) : null}
              {view.types.map(t => (
                <View key={t.name} style={styles.type}>
                  <Body bold>{t.name}</Body>
                  <Body>{t.goodFor}</Body>
                  {t.sources.map(src => (
                    <Button
                      key={src.url}
                      label={`Source: ${src.title}`}
                      variant="quiet"
                      onPress={() => openWebsite(src.url)}
                    />
                  ))}
                </View>
              ))}
              <Body muted>
                Leads, not verdicts: this is what people often say online. You
                know your baking best.
              </Body>
            </Card>
          )}

          <SectionTitle>Your picks near you</SectionTitle>
          {view.leads === null ? (
            <Card>
              <Body muted>Finding stores near the bakery…</Body>
            </Card>
          ) : picks.length === 0 ? (
            <Card>
              <Body>No stores found nearby for “{view.query}”.</Body>
            </Card>
          ) : (
            <>
              {!view.leadsLive ? (
                <Badge tone="warn" label="Sample stores (fictional, for the demo)" />
              ) : null}
              <Body muted>
                Three different kinds of store, each good at something
                different.
              </Body>
              {picks.map(p => (
                <PickCard
                  key={p.lead.placeId}
                  pick={p}
                  selected={selected.includes(p.lead.placeId)}
                  onToggle={() =>
                    setSelected(sel =>
                      sel.includes(p.lead.placeId)
                        ? sel.filter(x => x !== p.lead.placeId)
                        : [...sel, p.lead.placeId],
                    )
                  }
                />
              ))}
              <Button
                label={`Draft emails (${emailPicks.length})`}
                icon="mail"
                disabled={emailPicks.length === 0}
                onPress={draftSelected}
              />
              <Button
                label={showAll ? 'Hide other stores' : `Show all nearby (${view.leads.length})`}
                variant="quiet"
                onPress={() => setShowAll(v => !v)}
              />
              {showAll ? (
                <Card>
                  {[...view.leads]
                    .sort((a, b) => a.distanceKm - b.distanceKm)
                    .map(l => (
                      <Body key={l.placeId}>
                        {leadLine(l.name, l.distanceKm, isChain(l, view.leads!))}
                      </Body>
                    ))}
                </Card>
              ) : null}
            </>
          )}
        </>
      ) : null}

      <SectionTitle>Your vendors</SectionTitle>
      {myVendors.length === 0 ? (
        <Card>
          <Body muted>
            Vendors you email show up here, with their replies and quoted
            prices.
          </Body>
        </Card>
      ) : (
        myVendors.map(s => (
          <VendorCard
            key={s.id}
            supplier={s}
            onEmail={() => {
              const last = state.contacts
                .filter(c => c.supplierId === s.id)
                .sort((a, b) => b.sentOn.localeCompare(a.sentOn))[0];
              const ing = state.ingredients.find(i => i.id === (last?.ingredientId ?? view?.ingredientId));
              open({
                kind: 'drafts',
                supplierIds: [s.id],
                ingredientId: ing?.id ?? null,
                label: last?.ingredientLabel ?? view?.query ?? ing?.name ?? 'ingredients',
              });
            }}
            onReply={ingredientId =>
              open({
                kind: 'reply',
                supplierId: s.id,
                // No email recorded yet: assume the ingredient being searched.
                ingredientId: ingredientId ?? view?.ingredientId ?? null,
              })
            }
            onFollowUp={contactId => open({ kind: 'followup', contactId })}
          />
        ))
      )}

      <Sheet
        visible={sheet !== null}
        title={sheet ? SHEET_TITLES[sheet.kind] : ''}
        onClose={() => setSheet(null)}>
        {sheet?.kind === 'drafts' ? (
          <View key={sheetKey} style={styles.sheetStack}>
            <Body muted>
              Check each email, then tap Open in Mail. It opens in your own mail
              app with your name on it. Nothing is sent until you press Send.
            </Body>
            {sheet.supplierIds.map(id => {
              const supplier = state.suppliers.find(x => x.id === id);
              if (!supplier) {
                return null;
              }
              const ing = state.ingredients.find(i => i.id === sheet.ingredientId);
              const weekly = ing ? weeklyUsage(state, ing.id, today) : 0;
              const draft = draftQuoteEmail(state, {
                vendorName: supplier.name,
                vendorEmail: supplier.email,
                ingredientLabel: sheet.label,
                weeklyQty: ing && weekly > 0 ? { qty: weekly, unit: ing.unit } : undefined,
              });
              return (
                <DraftCard
                  key={id}
                  supplier={supplier}
                  initial={draft}
                  onOpened={() => {
                    run(s =>
                      recordEmailSent(s, {
                        supplierId: id,
                        ingredientId: sheet.ingredientId,
                        ingredientLabel: sheet.label,
                      }),
                    );
                  }}
                />
              );
            })}
            <Button label="Done" variant="secondary" onPress={() => done('When a vendor replies, tap "Add their reply" on their card.')} />
          </View>
        ) : null}
        {sheet?.kind === 'reply' ? (
          <PasteReplyForm
            key={sheetKey}
            supplierId={sheet.supplierId}
            initialIngredientId={sheet.ingredientId}
            onDone={done}
          />
        ) : null}
        {sheet?.kind === 'followup' ? (
          <FollowUpForm key={sheetKey} contactId={sheet.contactId} onDone={done} />
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between' },
  name: { fontSize: font.subheading, flexShrink: 1 },
  type: { gap: 4, paddingVertical: 4 },
  quote: { gap: 4 },
  sheetStack: { gap: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridBtn: { flexGrow: 1, flexBasis: '45%' },
});
