import { describe, expect, test } from 'bun:test';
import {
  bigintToJsonSafe,
  normalizePgInt8Rows,
  normalizePgInt8Value,
} from '@pkgs/sql-client-postgres-shared/normalize-pg-int8';

describe('bigintToJsonSafe', () => {
  test('safe int8 becomes number via decimal text (engine-safe)', () => {
    expect(bigintToJsonSafe(42n)).toBe(42);
    expect(typeof bigintToJsonSafe(42n)).toBe('number');
    expect(bigintToJsonSafe(-7n)).toBe(-7);
  });

  test('unsafe int8 becomes decimal string', () => {
    const huge = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    expect(bigintToJsonSafe(huge)).toBe(huge.toString());
  });
});

describe('normalizePgInt8Value', () => {
  test('safe int8 bigint becomes number', () => {
    expect(normalizePgInt8Value(42n)).toBe(42);
    expect(typeof normalizePgInt8Value(42n)).toBe('number');
  });

  test('unsafe int8 bigint becomes decimal string', () => {
    const huge = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    expect(normalizePgInt8Value(huge)).toBe(huge.toString());
  });

  test('non-bigint values pass through', () => {
    expect(normalizePgInt8Value(7)).toBe(7);
    expect(normalizePgInt8Value('x')).toBe('x');
    expect(normalizePgInt8Value(null)).toBe(null);
  });

  test('nested arrays and plain objects are walked', () => {
    expect(normalizePgInt8Value({ n: 5n, kids: [1n, { k: 2n }] })).toEqual({
      n: 5,
      kids: [1, { k: 2 }],
    });
  });

  test('Date and Uint8Array pass through', () => {
    const when = new Date('2020-01-01T00:00:00.000Z');
    const bytes = new Uint8Array([1, 2]);
    expect(normalizePgInt8Value(when)).toBe(when);
    expect(normalizePgInt8Value(bytes)).toBe(bytes);
  });
});

describe('normalizePgInt8Rows', () => {
  test('coerces row fields so JSON.stringify and Math.max work', () => {
    const rows = normalizePgInt8Rows<Record<string, unknown>>([
      { n: 5n, label: 'ok' },
    ]);
    expect(rows[0]?.['n']).toBe(5);
    expect(() => JSON.stringify(rows)).not.toThrow();
    expect(Math.max(0, Number(rows[0]!['n']))).toBe(5);
  });
});
