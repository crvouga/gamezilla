import { BLOCKED_TERMS } from './blocklist';

/** Homoglyph / leetspeak substitutions applied before matching. */
const SUBSTITUTIONS: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'i',
};

const REPEATED_RUN = /(.)\1{2,}/g;

/**
 * Canonical form for matching: NFKC, lower-case, leetspeak folded, separators
 * dropped, and runs of 3+ identical characters collapsed to one. Disguises
 * such as `f.u_c-k` or `fuuuck` collapse to `fuck`.
 */
export function normalizeForMatch(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z]/g, (char) => SUBSTITUTIONS[char] ?? '')
    .replace(REPEATED_RUN, '$1');
}

const NORMALIZED_BLOCKED_TERMS = BLOCKED_TERMS.map(normalizeForMatch);

/** True when the text contains a blocked term, disguised or not. */
export function containsBlockedTerm(raw: string): boolean {
  const normalized = normalizeForMatch(raw);
  if (normalized.length === 0) return false;
  return NORMALIZED_BLOCKED_TERMS.some((term) => normalized.includes(term));
}
