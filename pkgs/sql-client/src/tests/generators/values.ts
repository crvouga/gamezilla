import { arbJsonValue, fc } from '@pkgs/pbt';
import type { LogicalColumnType } from '../oracles/canonical-dump';

/** Integer landmines that surface as Postgres int8 / SQLite INTEGER. */
export const INTEGER_LANDMINES: readonly number[] = [
  0,
  1,
  -1,
  2 ** 31 - 1,
  2 ** 31,
  -(2 ** 31),
  Number.MAX_SAFE_INTEGER,
];

/** Values too large for Number — bind as decimal string, SELECT still returns int8. */
export const UNSAFE_INTEGER_STRINGS: readonly string[] = [
  String(BigInt(Number.MAX_SAFE_INTEGER) + 1n),
  String(-(BigInt(Number.MAX_SAFE_INTEGER) + 1n)),
];

export const arbSafeInteger = (): fc.Arbitrary<number> =>
  fc.oneof(
    fc.constantFrom(...INTEGER_LANDMINES),
    fc.integer({ min: -10_000, max: 10_000 })
  );

export const arbIntegerBind = (): fc.Arbitrary<number | string> =>
  // Safe integers only for insert roundtrip / portable agreement.
  // Unsafe int8 landmines live in wire-safety + bug-bigint pin via SELECT casts.
  arbSafeInteger();

const ISO_TIMESTAMPS = [
  '2020-01-01T00:00:00.000Z',
  '1970-01-01T00:00:00.000Z',
  '2038-01-19T03:14:07.000Z',
] as const;

const DATES = ['2020-01-01', '1970-01-01', '2099-12-31'] as const;

export function arbValueForType(
  type: LogicalColumnType
): fc.Arbitrary<unknown> {
  switch (type) {
    case 'uuid':
    case 'text':
      return fc.oneof(
        fc.constant(null),
        fc.string({ minLength: 1, maxLength: 24 }),
        fc.constantFrom('hello', 'ユニコード', 'a'.repeat(40))
      );
    case 'integer':
      return fc.oneof(fc.constant(null), arbIntegerBind());
    case 'boolean':
      return fc.oneof(fc.constant(null), fc.boolean());
    case 'timestamp':
      return fc.oneof(fc.constant(null), fc.constantFrom(...ISO_TIMESTAMPS));
    case 'date':
      return fc.oneof(fc.constant(null), fc.constantFrom(...DATES));
    case 'json':
      return fc.oneof(
        fc.constant(null),
        arbJsonValue(2),
        fc.constant({ n: 42, nested: { k: [1, 2] } })
      );
    case 'real':
      return fc.oneof(
        fc.constant(null),
        fc
          .double({
            min: -1e6,
            max: 1e6,
            noNaN: true,
            noDefaultInfinity: true,
          })
          .filter((n) => n === 0 || (Number.isFinite(n) && Math.abs(n) >= 1e-3))
      );
    case 'numeric':
      return fc.oneof(
        fc.constant(null),
        arbSafeInteger().map(String),
        fc.constantFrom('0.5', '999999999999999999')
      );
    case 'blob':
      return fc.oneof(
        fc.constant(null),
        fc.uint8Array({ minLength: 0, maxLength: 16 })
      );
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
