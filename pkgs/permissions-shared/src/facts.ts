/** One fact value. Arrays model multi-valued facts (e.g. active products). */
export type FactValue = string | number | boolean | null | readonly string[];

/** Everything the resolver knows about a subject. Keys are policy vocabulary. */
export type Facts = Readonly<Record<string, FactValue>>;

/**
 * Role / restriction predicate. `'always'` matches every subject; an object
 * matches when every key matches (AND). A key's expected value is either one
 * scalar (equality) or an array (any-of). A multi-valued fact matches when it
 * shares at least one element with the expectation.
 */
export type FactPredicate =
  | 'always'
  | Readonly<
      Record<string, string | number | boolean | null | readonly string[]>
    >;

function asList(value: FactValue | undefined): readonly unknown[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function keyMatches(
  fact: FactValue | undefined,
  expected: string | number | boolean | null | readonly string[]
): boolean {
  const have = asList(fact);
  const want: readonly unknown[] = Array.isArray(expected)
    ? expected
    : [expected];
  if (fact === undefined) return want.includes(null);
  return have.some((value) => want.includes(value));
}

/** Whether `facts` satisfy `predicate`. A missing fact only matches `null`. */
export function matchesPredicate(
  predicate: FactPredicate,
  facts: Facts
): boolean {
  if (predicate === 'always') return true;
  for (const [key, expected] of Object.entries(predicate)) {
    if (!keyMatches(facts[key], expected)) return false;
  }
  return true;
}

/**
 * Stable hash of a fact record (sorted keys, JSON values) so caches keyed on
 * facts invalidate exactly when a fact changes.
 */
export function factsHash(facts: Facts): string {
  const keys = Object.keys(facts).sort();
  return keys.map((key) => `${key}=${JSON.stringify(facts[key])}`).join('&');
}
