import { ALLOWED_WORDS, BLOCKED_TERMS } from './blocklist';

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

/** Each allowed word, as matching sees it (any letter run or longer). */
const ALLOWED_PATTERN =
  ALLOWED_WORDS.length === 0
    ? null
    : new RegExp(
        ALLOWED_WORDS.map((w) => termPattern(w).source).join('|'),
        'g'
      );

/** True when `raw` holds an allowed word such as `Scunthorpe`. */
export function containsAllowedWord(raw: string): boolean {
  if (ALLOWED_PATTERN === null) return false;
  ALLOWED_PATTERN.lastIndex = 0;
  return ALLOWED_PATTERN.test(normalizeForMatch(raw));
}

/**
 * True when the text contains a blocked term, disguised or not, outside the
 * allowed words (which are cut out first, so a term spanning one is not
 * pieced together across the cut).
 */
export function containsBlockedTerm(raw: string): boolean {
  const normalized = normalizeForMatch(raw);
  if (normalized.length === 0) return false;
  const pieces =
    ALLOWED_PATTERN === null ? [normalized] : normalized.split(ALLOWED_PATTERN);
  return pieces.some((piece) =>
    BLOCKED_PATTERNS.some((pattern) => pattern.test(piece))
  );
}
