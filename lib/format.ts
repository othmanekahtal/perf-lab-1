export function money(cents: number, currency = 'EUR', locale = 'en-IE') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);
}

export function moneyExact(cents: number, currency = 'EUR', locale = 'en-IE') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

export function shortDate(iso: string, locale = 'en-IE') {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso));
}

export function dateTime(iso: string, locale = 'en-IE') {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(iso));
}

export function productImage(index: number) {
  return `/products/p${index}.jpg`;
}

/** "Today" for the store; the dataset is frozen at this date so every run is deterministic. */
export const STORE_TODAY = '2026-10-31T23:59:59.000Z';
