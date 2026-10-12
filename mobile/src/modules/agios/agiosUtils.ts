import type { Agio } from './agiosApi';

export const AGIOS_CURRENCY = 'MAD';

/** Treat dates as calendar days, never UTC instants that can shift a day. */
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function creditDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function formatCreditDate(value: string): string {
  return creditDate(value).toLocaleDateString(undefined, {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function normalizeAmount(value: string): string | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  if (Number(whole) === 0 && Number(fraction) === 0) return null;
  return `${Number(whole)}.${fraction.padEnd(2, '0')}`;
}

export function amountInCents(amount: string): number {
  const negative = amount.startsWith('-');
  const [whole, fraction = ''] = (negative ? amount.slice(1) : amount).split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return negative ? -cents : cents;
}

export function summarizeAgios(entries: Agio[], year: number) {
  return entries.reduce((summary, entry) => {
    const cents = amountInCents(entry.amount);
    summary.balance += cents;
    if (cents < 0) {
      summary.withdrawn -= cents;
    } else {
      summary.earned += cents;
      if (entry.date.startsWith(`${year}-`)) summary.yearEarned += cents;
    }
    return summary;
  }, { balance: 0, earned: 0, withdrawn: 0, yearEarned: 0 });
}

export function formatEntryAmount(amount: string): string {
  const cents = amountInCents(amount);
  return `${cents < 0 ? '−' : '+'}${formatMoney(Math.abs(cents))}`;
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency', currency: AGIOS_CURRENCY, currencyDisplay: 'code',
  }).format(cents / 100);
}

export function sortAgios(entries: Agio[]): Agio[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date)
    || Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
}
