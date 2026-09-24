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

/**
 * Canonical form for matching: NFKD (so accents split off and are dropped),
 * lower-case, leetspeak folded, separators dropped. Disguises such as
 * `f.u_c-k`, `FüCK` or `5h1t` fold to plain letters. Repeated letters are kept:
 * {@link containsBlockedTerm} matches every letter run as "that run or longer".
 */
export function normalizeForMatch(raw: string): string {
  return raw
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z]/g, (char) => SUBSTITUTIONS[char] ?? '');
}

/**
 * Each run of a letter in the term matches that many or more of it, so
 * `fuuck` and `faggggot` match while `fagot` / `niger` (a shorter run than the
 * term's) stay clean.
 */
function termPattern(term: string): RegExp {
  const runs = normalizeForMatch(term).match(/([a-z])\1*/g) ?? [];
  return new RegExp(runs.map((run) => `${run[0]}{${run.length},}`).join(''));
}

const BLOCKED_PATTERNS = BLOCKED_TERMS.map(termPattern);

/** True when the text contains a blocked term, disguised or not. */
export function containsBlockedTerm(raw: string): boolean {
  const normalized = normalizeForMatch(raw);
  if (normalized.length === 0) return false;
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(normalized));
}
