import fc from 'fast-check';

/** Stable-looking user ids (not necessarily UUID-shaped). */
export const arbUserId = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.uuid(),
    fc
      .tuple(
        fc.stringMatching(/^[a-z]{2,8}$/),
        fc.integer({ min: 0, max: 9999 })
      )
      .map(([p, n]) => `${p}_${n}`)
  );

export const arbDistinctUserPair = (): fc.Arbitrary<[string, string]> =>
  fc
    .tuple(arbUserId(), arbUserId())
    .filter(([a, b]) => a !== b) as fc.Arbitrary<[string, string]>;
