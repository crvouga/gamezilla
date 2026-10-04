import fc from 'fast-check';

const LOWER = [...'abcdefghijklmnopqrstuvwxyz'];
const LOWER_DIGIT = [...'abcdefghijklmnopqrstuvwxyz0123456789'];

/** Single kebab segment matching wire keyword rules (length 2–16 for speed). */
export const arbKebabSegment = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.constantFrom(...LOWER),
      fc.array(fc.constantFrom(...LOWER_DIGIT), {
        minLength: 1,
        maxLength: 10,
      }),
      fc.option(
        fc
          .array(fc.constantFrom(...LOWER_DIGIT), {
            minLength: 1,
            maxLength: 5,
          })
          .map((tail) => `-${tail.join('')}`),
        { nil: undefined }
      )
    )
    .map(([head, mid, extra]) => `${head}${mid.join('')}${extra ?? ''}`);

/** Construct a valid `ns.sub/local` keyword (no filter starvation). */
export const arbNamespacedKeyword = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.array(arbKebabSegment(), { minLength: 1, maxLength: 3 }),
      arbKebabSegment()
    )
    .map(([ns, local]) => `${ns.join('.')}/${local}`);

/**
 * Characters that sit on every rule's edge: the legal alphabet, the two
 * separators, and near-misses (case, underscore, whitespace, control,
 * non-ASCII, astral).
 */
const NEAR_MISS_CHARS = [
  'a',
  'b',
  'z',
  '0',
  '9',
  '-',
  '.',
  '/',
  'A',
  '_',
  ' ',
  '\n',
  '\0',
  'é',
  'т',
  '😀',
];

/** Short strings over {@link NEAR_MISS_CHARS}: valid and invalid in about equal measure. */
export const arbNearMissString = (): fc.Arbitrary<string> =>
  fc
    .array(fc.constantFrom(...NEAR_MISS_CHARS), { maxLength: 14 })
    .map((chars) => chars.join(''));

/** A valid keyword with one character inserted, deleted or replaced. */
export const arbMutatedKeyword = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      arbNamespacedKeyword(),
      fc.nat(),
      fc.constantFrom('insert', 'delete', 'replace'),
      fc.constantFrom(...NEAR_MISS_CHARS)
    )
    .map(([key, at, op, char]) => {
      const i = at % (key.length + 1);
      const tail = op === 'insert' ? key.slice(i) : key.slice(i + 1);
      const middle = op === 'delete' ? '' : char;
      return `${key.slice(0, i)}${middle}${tail}`;
    });

/** A segment of `length` code units (`kx…`). */
const segmentOfLength = (length: number): string =>
  `k${'x'.repeat(length - 1)}`;

/**
 * Segment lengths on either side of the 2 and 64 bounds, mostly legal so one
 * out-of-bounds segment is not masked by another.
 */
const arbBoundarySegment = (legal: readonly number[]): fc.Arbitrary<string> =>
  fc
    .oneof(
      { weight: 8, arbitrary: fc.constantFrom(...legal) },
      { weight: 1, arbitrary: fc.constantFrom(1, 65) }
    )
    .map(segmentOfLength);

const arbKeywordFrom = (
  counts: readonly number[],
  legal: readonly number[]
): fc.Arbitrary<string> =>
  fc
    .constantFrom(...counts)
    .chain((count) =>
      fc.tuple(
        fc.array(arbBoundarySegment(legal), {
          minLength: count,
          maxLength: count,
        }),
        arbBoundarySegment(legal)
      )
    )
    .map(([ns, local]) => `${ns.join('.')}/${local}`);

/**
 * Keywords on the caps: few long segments (segment length 63–65, total length
 * past 256) or many short ones (15–17 namespace segments).
 */
export const arbBoundaryKeyword = (): fc.Arbitrary<string> =>
  fc.oneof(
    arbKeywordFrom([1, 2, 3, 4], [2, 63, 64]),
    arbKeywordFrom([15, 16, 17], [2, 3])
  );

/** Any string worth asking the keyword predicates about. */
export const arbKeywordCandidate = (): fc.Arbitrary<string> =>
  fc.oneof(
    arbNamespacedKeyword(),
    arbMutatedKeyword(),
    arbNearMissString(),
    arbBoundaryKeyword()
  );
