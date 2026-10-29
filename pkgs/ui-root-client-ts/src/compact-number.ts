/**
 * Compact counts for the design system: from 1,000 a count reads the short
 * way its locale writes it (`12.4K` in English, `1.2万` in Japanese), with at
 * most one fractional digit; below that it is the plain number. Locales that
 * do not shorten thousands (German keeps `12.400`) keep their own convention.
 *
 * Pure: the locale is a parameter (`useLingui().i18n().locale` in a
 * component), never read from the runtime. It lives in the client package
 * because `Intl` is banned in shared code (`no-locale-apis.grit`).
 */

const FALLBACK_LOCALE = 'en';

const formatters = new Map<string, Intl.NumberFormat>();

function createFormatter(locale: string): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
}

function formatterFor(locale: string): Intl.NumberFormat {
  const cached = formatters.get(locale);
  if (cached !== undefined) return cached;
  let formatter: Intl.NumberFormat;
  try {
    formatter = createFormatter(locale);
  } catch {
    // An invalid BCP 47 tag throws `RangeError`; read it as the fallback.
    formatter = formatterFor(FALLBACK_LOCALE);
  }
  formatters.set(locale, formatter);
  return formatter;
}

/** `value` as a compact, locale-aware count (`12400` → `12.4K` in `en`). */
export function formatCompactNumber(value: number, locale: string): string {
  return formatterFor(locale).format(value);
}
