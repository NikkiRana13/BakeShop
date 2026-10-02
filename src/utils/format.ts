import { BaseUnit, PackageUnit } from '../types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Local calendar date key, YYYY-MM-DD. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(now: Date = new Date()): string {
  return dateKey(now);
}

export function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!m) {
    return null;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) {
    return null;
  }
  return d;
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key) as Date;
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/** Whole calendar days from `from` to `to` (both date keys). */
export function daysBetween(from: string, to: string): number {
  const a = parseDateKey(from) as Date;
  const b = parseDateKey(to) as Date;
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

export function startOfDay(key: string): Date {
  return parseDateKey(key) as Date;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDate(key: string): string {
  const d = parseDateKey(key);
  if (!d) {
    return key;
  }
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function formatDayLabel(key: string, today: string): string {
  const diff = daysBetween(today, key);
  if (diff === 0) {
    return 'Today';
  }
  if (diff === -1) {
    return 'Yesterday';
  }
  return formatDate(key);
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(d.getMinutes())} ${suffix}`;
}

const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
];

export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** "today", "tomorrow", "in six days", "2 days ago". */
export function relativeDays(days: number): string {
  if (days === 0) {
    return 'today';
  }
  if (days === 1) {
    return 'tomorrow';
  }
  if (days < 0) {
    return days === -1 ? 'yesterday' : `${-days} days ago`;
  }
  return `in ${numberWord(days)} days`;
}

function withCommas(n: number): string {
  const [whole, frac] = String(n).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac}` : grouped;
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '−' : '';
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  return `${sign}$${withCommas(dollars)}.${pad(abs % 100)}`;
}

/** Parses "4.50", "$4.5", "1,200" into integer cents. Null when invalid. */
export function parseDollars(input: string): number | null {
  const s = input.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(s) && !/^\.\d{1,2}$/.test(s)) {
    return null;
  }
  const [whole, frac = ''] = s.split('.');
  return Number(whole || '0') * 100 + Number((frac + '00').slice(0, 2));
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Parses a positive quantity (decimals allowed). Null when invalid. */
export function parseQuantity(input: string): number | null {
  const s = input.replace(/[,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) {
    return null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function roundQty(n: number): number {
  return Math.round(n * 100) / 100;
}

export function unitLabel(unit: BaseUnit | PackageUnit, qty = 2): string {
  if (unit === 'unit') {
    return qty === 1 ? 'unit' : 'units';
  }
  return unit;
}

export function formatQty(qty: number, unit: BaseUnit | PackageUnit): string {
  const q = roundQty(qty);
  return `${withCommas(q)} ${unitLabel(unit, q)}`;
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function toBaseQuantity(
  size: number,
  unit: PackageUnit,
  base: BaseUnit,
): number | null {
  if (unit === base) {
    return size;
  }
  if (unit === 'kg' && base === 'g') {
    return size * 1000;
  }
  if (unit === 'L' && base === 'mL') {
    return size * 1000;
  }
  return null;
}

let idCounter = 0;
export function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}
