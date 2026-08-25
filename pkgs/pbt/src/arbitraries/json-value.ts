import fc from 'fast-check';

/** Finite JSON numbers (no NaN / ±Infinity — those break canonical JSON). */
export const arbFiniteNumber = (): fc.Arbitrary<number> =>
  fc.double({
    min: -1e9,
    max: 1e9,
    noNaN: true,
    noDefaultInfinity: true,
  });

/**
 * Object keys biased toward the JS integer-index gotcha
 * (`"10"` sorts before `"2"` under `Object.keys` numeric ordering).
 */
export const arbJsonKey = (): fc.Arbitrary<string> =>
  fc.oneof(
    { arbitrary: fc.stringMatching(/^[a-z][a-z0-9_]{0,8}$/), weight: 5 },
    { arbitrary: fc.integer({ min: 0, max: 20 }).map(String), weight: 2 },
    { arbitrary: fc.constantFrom('', ' ', '🚀', '__proto__'), weight: 1 }
  );

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [k: string]: JsonValue };

export const arbJsonValue = (maxDepth = 3): fc.Arbitrary<JsonValue> => {
  const leaf: fc.Arbitrary<JsonValue> = fc.oneof(
    fc.constant(null),
    fc.boolean(),
    arbFiniteNumber(),
    fc.string({ maxLength: 24 })
  );

  const value = fc.letrec((tie) => ({
    v: fc.oneof(
      { arbitrary: leaf, weight: 4 },
      {
        arbitrary: fc.array(tie('v'), { maxLength: 4 }),
        weight: 2,
      },
      {
        arbitrary: fc.dictionary(arbJsonKey(), tie('v'), {
          maxKeys: 4,
        }),
        weight: 2,
      }
    ),
  })).v;

  // Depth is soft-capped via size of nested structures above.
  void maxDepth;
  return value as fc.Arbitrary<JsonValue>;
};

export const arbJsonObject = (): fc.Arbitrary<Record<string, JsonValue>> =>
  fc.dictionary(arbJsonKey(), arbJsonValue(), { maxKeys: 6 });
