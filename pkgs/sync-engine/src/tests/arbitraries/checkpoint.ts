import fc from 'fast-check';

export const arbCheckpoint = (): fc.Arbitrary<string> =>
  fc.bigInt({ min: 0n, max: 10_000n }).map((n) => n.toString());

export const arbLegacyCheckpoint = (): fc.Arbitrary<string> =>
  fc
    .bigInt({ min: 10n ** 15n, max: 10n ** 15n + 1_000_000n })
    .map((n) => n.toString());

export const arbQueryTables = (): fc.Arbitrary<
  Record<string, Record<string, unknown>[]>
> =>
  fc.dictionary(
    fc.stringMatching(/^[a-z][a-z0-9_]{0,10}$/),
    fc.array(
      fc.record({
        id: fc.uuid(),
        body: fc.string({ maxLength: 20 }),
        n: fc.integer({ min: 0, max: 100 }),
      }),
      { maxLength: 4 }
    ),
    { maxKeys: 3 }
  );
