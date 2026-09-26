/**
 * Near-duplicate step wording. Two definitions of the same kind that differ
 * only in filler ("again", "still", "own", articles, tense) are one behavior
 * with two names — the spec writer picks the wrong one and the catalog
 * splits. A negation, a different verb or a different object is a different
 * behavior and is never flagged. Deterministic, no fuzzy libraries.
 */

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'to',
  'of',
  'and',
  'as',
  'his',
  'her',
  'their',
  'them',
  'themselves',
  'has',
  'have',
  'that',
  'this',
  'it',
  'its',
]);

/** Words whose presence alone never makes a step a different behavior. */
const FILLER = new Set([
  '_',
  'again',
  'still',
  'own',
  'open',
  'now',
  'then',
  'already',
  'just',
  'also',
  'back',
  'can',
  'could',
  'will',
  'would',
  'be',
  'been',
  'being',
  'do',
  'does',
  'did',
  'in',
  'on',
  'at',
  'for',
  'with',
  'from',
  'by',
  'up',
]);

const NEGATION = new Set([
  'not',
  'no',
  'never',
  'nobody',
  'nothing',
  'cannot',
  'without',
]);

function stem(token: string): string {
  if (token.length <= 3) return token;
  return token
    .replace(/ies$/, 'y')
    .replace(/(ing|ed|es)$/, '')
    .replace(/s$/, '');
}

/** Parameters collapse to one token, plurals and possessives fold. */
export function normalizeStepText(text: string): readonly string[] {
  return text
    .toLowerCase()
    .replace(/\{[^}]*\}/g, ' _ ')
    .replace(/'s\b/g, '')
    .replace(/[^a-z0-9_ ]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token))
    .map(stem);
}

function multisetDifference(
  a: readonly string[],
  b: readonly string[]
): string[] {
  const counts = new Map<string, number>();
  for (const token of a) counts.set(token, (counts.get(token) ?? 0) + 1);
  for (const token of b) counts.set(token, (counts.get(token) ?? 0) - 1);
  const out: string[] = [];
  for (const [token, n] of counts) {
    for (let i = 0; i < Math.abs(n); i++) out.push(token);
  }
  return out;
}

function negated(tokens: readonly string[]): boolean {
  return tokens.some((token) => NEGATION.has(token));
}

/**
 * Whether two wordings say the same thing: same negation, same number of
 * parameters, and everything that differs between them is filler.
 */
export function sameBehavior(
  a: readonly string[],
  b: readonly string[]
): boolean {
  if (negated(a) !== negated(b)) return false;
  const arity = (tokens: readonly string[]) =>
    tokens.filter((t) => t === '_').length;
  if (arity(a) !== arity(b)) return false;
  const diff = multisetDifference(a, b);
  return diff.every((token) => FILLER.has(token));
}

export type NearDuplicate<T> = {
  readonly a: T;
  readonly b: T;
};

/**
 * Pairs of distinct texts of the same kind that say the same thing
 * (order: as given).
 */
export function nearDuplicates<T>(
  items: readonly T[],
  textOf: (item: T) => string,
  kindOf: (item: T) => string = () => ''
): readonly NearDuplicate<T>[] {
  const tokens = items.map((item) => normalizeStepText(textOf(item)));
  const out: NearDuplicate<T>[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a === undefined || b === undefined) continue;
      if (textOf(a) === textOf(b) || kindOf(a) !== kindOf(b)) continue;
      if (sameBehavior(tokens[i] ?? [], tokens[j] ?? [])) out.push({ a, b });
    }
  }
  return out;
}
