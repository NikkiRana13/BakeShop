/**
 * Reading a price out of a vendor's reply without the server. Handles plain
 * replies like "$19 for a 5 kg pail, we deliver Thursdays for $8"; anything
 * vaguer comes back as found: false so Grandma reads the email herself rather
 * than the app guessing.
 */
import { PackageUnit } from '../types';
import { parseDollars } from '../utils/format';

export interface ExtractedQuote {
  found: boolean;
  priceCents?: number;
  packageSize?: number;
  packageUnit?: PackageUnit;
  deliveryFeeCents?: number;
  deliveryNote?: string;
  /** In the ingredient's base unit (g, mL or units). */
  minOrderQty?: number;
  seasonalNote?: string;
  /** Why no price was found, or anything Grandma should double-check. */
  note?: string;
}

const UNIT = '(kg|kilos?|kilograms?|g|grams?|l|litres?|liters?|ml|millilitres?|milliliters?)';

function toUnit(raw: string): PackageUnit {
  const u = raw.toLowerCase();
  if (u.startsWith('k')) {
    return 'kg';
  }
  if (u === 'ml' || u.startsWith('milli')) {
    return 'mL';
  }
  if (u === 'l' || u.startsWith('lit')) {
    return 'L';
  }
  return 'g';
}

function toBase(qty: number, unit: PackageUnit): number {
  return unit === 'kg' || unit === 'L' ? qty * 1000 : qty;
}

function sentences(text: string): string[] {
  // Avoids regex lookbehind, which older phone JavaScript engines lack.
  return (text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*/g) ?? [])
    .map(s => s.trim())
    .filter(Boolean);
}

export function parseQuoteLocally(text: string): ExtractedQuote {
  const flat = text.replace(/\s+/g, ' ');
  // "$19 for a 5 kg pail", "$3.80/kg", "$6 per kilo"
  const priceRe = new RegExp(
    `\\$\\s?(\\d+(?:\\.\\d{1,2})?)\\s*(?:\\/|per|a|for an?|for)\\s*(\\d+(?:\\.\\d+)?)?\\s*${UNIT}\\b`,
    'i',
  );
  const m = priceRe.exec(flat);
  if (!m) {
    return {
      found: false,
      note: 'No clear price in this reply. Read it below and enter the price yourself, or give them a call.',
    };
  }
  const priceCents = parseDollars(m[1]);
  const packageUnit = toUnit(m[3]);
  const packageSize = m[2] ? Number(m[2]) : 1;
  if (priceCents === null || priceCents <= 0) {
    return { found: false, note: 'The price in this reply could not be read.' };
  }

  const all = sentences(text);
  const deliverySentence = all.find(s => /deliver/i.test(s));
  const feeMatch = deliverySentence
    ? /\$\s?(\d+(?:\.\d{1,2})?)/.exec(
        deliverySentence.replace(m[0], ''),
      )
    : null;
  const freeDelivery = deliverySentence
    ? /free delivery|deliver\w* (?:for )?free/i.test(deliverySentence)
    : false;
  const minMatch = new RegExp(
    `minimum[^.]*?(\\d+(?:\\.\\d+)?)\\s*${UNIT}\\b`,
    'i',
  ).exec(flat);
  const seasonal = all.find(s =>
    /season|winter|summer|spring|fall|autumn|holiday/i.test(s),
  );
  const dayMatch = deliverySentence
    ? /(mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?|weekly|every week)/i.exec(
        deliverySentence,
      )
    : null;

  return {
    found: true,
    priceCents,
    packageSize,
    packageUnit,
    deliveryFeeCents: feeMatch
      ? parseDollars(feeMatch[1]) ?? undefined
      : freeDelivery
      ? 0
      : undefined,
    deliveryNote: dayMatch
      ? `Delivers ${dayMatch[1].toLowerCase()}`
      : deliverySentence
      ? 'Delivers (see email)'
      : undefined,
    minOrderQty: minMatch
      ? toBase(Number(minMatch[1]), toUnit(minMatch[2]))
      : undefined,
    seasonalNote: seasonal,
    note: 'Read automatically. Check it against the email before saving.',
  };
}
