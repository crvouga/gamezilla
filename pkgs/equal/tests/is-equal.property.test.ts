import { describe, expect, test } from 'bun:test';
import { isEqual } from '@pkgs/equal/is-equal';
import { arbJsonValue, assertProperty, fc } from '@pkgs/property';

/** Oracle: JSON with keys sorted at every level (no -0 / NaN in the domain). */
function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const obj = v as Record<string, unknown>;
  const body = Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(',');
  return `{${body}}`;
}

/** Deep copy with every object's keys re-inserted in reverse order. */
function reversedCopy(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(reversedCopy);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v).reverse()) {
    Object.defineProperty(out, k, {
      value: reversedCopy((v as Record<string, unknown>)[k]),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

/** Small domain so independently drawn pairs are often equal. */
const arbSmallJson = arbJsonValue(2).filter((v) => canonical(v).length < 60);

/** A pair that is sometimes equal (copy), sometimes differing only in one nested leaf, sometimes unrelated. */
const arbJsonPair = fc.oneof(
  arbJsonValue().map((a) => [a, reversedCopy(a)] as const),
  fc.tuple(arbSmallJson, arbSmallJson),
  fc.tuple(arbJsonValue(), arbSmallJson, arbSmallJson).map(
    ([a, l1, l2]) =>
      [
        { a, l: l1 },
        { l: l2, a: reversedCopy(a) },
      ] as const
  )
);

/** Values beyond JSON: Date, RegExp, Map, Set, NaN, -0, undefined, bigint. */
const { rich: arbRich } = fc.letrec<{ rich: unknown }>((tie) => ({
  rich: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.constantFrom(null, undefined, 0, -0, Number.NaN, 1, 'a', 1n, true),
    fc.integer({ min: 0, max: 3 }).map((t) => new Date(t)),
    fc
      .constantFrom('a', 'b')
      .chain((src) =>
        fc.constantFrom('', 'g').map((flags) => new RegExp(src, flags))
      ),
    fc.array(tie('rich'), { maxLength: 3 }),
    fc.dictionary(fc.constantFrom('a', 'b', 'c'), tie('rich'), { maxKeys: 3 }),
    fc
      .array(fc.tuple(fc.constantFrom('k', 'l', 1), tie('rich')), {
        maxLength: 3,
      })
      .map((es) => new Map(es)),
    fc
      .array(fc.constantFrom(1, 2, 'x', null), { maxLength: 3 })
      .map((xs) => new Set(xs))
  ),
}));

/** Structural deep clone preserving the rich types above. */
function cloneRich(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(cloneRich);
  if (v instanceof Date) return new Date(v.getTime());
  if (v instanceof RegExp) return new RegExp(v.source, v.flags);
  if (v instanceof Map) {
    return new Map([...v].map(([k, x]) => [k, cloneRich(x)] as const));
  }
  if (v instanceof Set) return new Set([...v].map(cloneRich));
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v).reverse()) {
    out[k] = cloneRich((v as Record<string, unknown>)[k]);
  }
  return out;
}

describe('isEqual properties', () => {
  test('agrees with the sorted-key JSON oracle on JSON values', () => {
    assertProperty(
      'json oracle',
      fc.property(arbJsonPair, ([a, b]) => {
        expect(isEqual(a, b)).toBe(canonical(a) === canonical(b));
      })
    );
  });

  test('reflexive: a value equals itself and its structural clone', () => {
    assertProperty(
      'reflexivity',
      fc.property(arbRich, (v) => {
        expect(isEqual(v, v)).toBe(true);
        expect(isEqual(v, cloneRich(v))).toBe(true);
      })
    );
  });

  test('symmetric on arbitrary rich pairs', () => {
    assertProperty(
      'symmetry',
      fc.property(arbRich, arbRich, (a, b) => {
        expect(isEqual(a, b)).toBe(isEqual(b, a));
      })
    );
  });

  test('transitive through a clone', () => {
    assertProperty(
      'transitivity',
      fc.property(arbRich, arbRich, (a, b) => {
        const c = cloneRich(b);
        if (isEqual(a, b)) expect(isEqual(a, c)).toBe(true);
      })
    );
  });

  test('Set / Map equality ignores insertion order', () => {
    assertProperty(
      'collection order independence',
      fc.property(
        fc.uniqueArray(fc.oneof(fc.integer({ max: 5 }), fc.string()), {
          maxLength: 6,
        }),
        (xs) => {
          const rev = [...xs].reverse();
          expect(isEqual(new Set(xs), new Set(rev))).toBe(true);
          const m1 = new Map(xs.map((x, i) => [x, { i }] as const));
          const m2 = new Map(
            rev.map((x) => [x, { i: xs.indexOf(x) }] as const)
          );
          expect(isEqual(m1, m2)).toBe(true);
        }
      )
    );
  });
});
