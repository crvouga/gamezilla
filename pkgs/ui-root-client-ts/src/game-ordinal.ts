/**
 * A finishing place as its ordinal (`1st`, `2nd`, `3rd`, `11th`, `22nd`).
 *
 * The place's ordinal category comes from `Intl.PluralRules` with
 * `type: 'ordinal'`, so the rule is the locale's own; the words for each
 * category are known for English. A language without a known table gets the
 * plain number, and a caller that has the localized word passes it to
 * `GameStandings` itself.
 *
 * Pure: the locale is a parameter (`useLingui().i18n().locale` in a
 * component). It lives in the client package because `Intl` is banned in
 * shared code (`no-locale-apis.grit`).
 */

const FALLBACK_LOCALE = 'en';

type OrdinalSuffixes = Readonly<Partial<Record<Intl.LDMLPluralRule, string>>>;

const SUFFIXES: Readonly<Record<string, OrdinalSuffixes>> = {
  en: { one: 'st', two: 'nd', few: 'rd', other: 'th' },
};

const rules = new Map<string, Intl.PluralRules>();

function rulesFor(locale: string): Intl.PluralRules {
  const cached = rules.get(locale);
  if (cached !== undefined) return cached;
  let created: Intl.PluralRules;
  try {
    created = new Intl.PluralRules(locale, { type: 'ordinal' });
  } catch {
    // An invalid BCP 47 tag throws `RangeError`; read it as the fallback.
    created = rulesFor(FALLBACK_LOCALE);
  }
  rules.set(locale, created);
  return created;
}

/** `place` as an ordinal in `locale` (`2` → `2nd` in `en`). */
export function formatOrdinal(place: number, locale: string): string {
  const language = locale.split('-')[0]?.toLowerCase() ?? '';
  const suffixes = SUFFIXES[language];
  if (suffixes === undefined) return String(place);
  const suffix = suffixes[rulesFor(locale).select(place)] ?? suffixes.other;
  return `${place}${suffix ?? ''}`;
}
