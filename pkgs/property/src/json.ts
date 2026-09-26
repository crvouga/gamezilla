import fc from 'fast-check';

/** A JSON value as `JSON.parse` returns it. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { readonly [k: string]: JsonValue };

/** Finite JSON numbers (no NaN / ±Infinity / -0 — JSON.stringify collapses -0 to 0). */
export const arbFiniteNumber = (): fc.Arbitrary<number> =>
  fc
    .double({
      min: -1e9,
      max: 1e9,
      noNaN: true,
      noDefaultInfinity: true,
    })
    .filter((n) => !Object.is(n, -0));

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

const arbJsonLeaf = (): fc.Arbitrary<JsonValue> =>
  fc.oneof(
    fc.constant(null),
    fc.boolean(),
    arbFiniteNumber(),
    fc.string({ maxLength: 24 })
  );

/** JSON values nested at most `maxDepth` containers deep (0 = leaves only). */
export const arbJsonValue = (maxDepth = 3): fc.Arbitrary<JsonValue> => {
  if (maxDepth <= 0) return arbJsonLeaf();
  const inner = arbJsonValue(maxDepth - 1);
  return fc.oneof(
    { arbitrary: arbJsonLeaf(), weight: 4 },
    { arbitrary: fc.array(inner, { maxLength: 4 }), weight: 2 },
    {
      arbitrary: fc.dictionary(arbJsonKey(), inner, { maxKeys: 4 }),
      weight: 2,
    }
  );
};

export const arbJsonObject = (
  maxDepth = 3
): fc.Arbitrary<Record<string, JsonValue>> =>
  fc.dictionary(arbJsonKey(), arbJsonValue(maxDepth), { maxKeys: 6 });
