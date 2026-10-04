import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import {
  canonicalRoomJson,
  fnv1a64Hex,
  hashRoomState,
} from '@pkgs/room-root-shared/hash-room-state';
import fc from 'fast-check';

/** Reference implementations (the previous, slower versions) kept for equivalence. */
function referenceCanonical(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortValue);
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const out = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    const v = obj[key];
    if (v !== undefined) out[key] = sortValue(v);
  }
  return out;
}

function referenceFnv(text: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i));
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, '0');
}

const jsonValue = fc.letrec((tie) => ({
  value: fc.oneof(
    { depthSize: 'small' },
    fc.constant(null),
    fc.constant(undefined),
    fc.boolean(),
    fc.double({ noNaN: false }),
    fc.string({ unit: 'binary' }),
    fc.array(tie('value'), { maxLength: 6 }),
    fc.dictionary(fc.string({ maxLength: 8 }), tie('value'), { maxKeys: 6 })
  ),
})).value;

describe('fnv1a64Hex', () => {
  test('matches the BigInt reference for arbitrary UTF-16 strings', () => {
    assertProperty(
      'fnv limb == bigint reference',
      fc.property(fc.string({ unit: 'binary', maxLength: 200 }), (s) => {
        expect(fnv1a64Hex(s)).toBe(referenceFnv(s));
      })
    );
    expect(fnv1a64Hex('')).toBe('cbf29ce484222325');
    expect(fnv1a64Hex('a')).toBe(referenceFnv('a'));
  });
});

describe('canonicalRoomJson', () => {
  test('matches the sorted-copy reference for arbitrary JSON-ish values', () => {
    assertProperty(
      'canonical == sorted-copy reference',
      fc.property(jsonValue, (v) => {
        expect(canonicalRoomJson(v)).toBe(referenceCanonical(v));
      })
    );
  });

  test('is insertion-order independent and drops undefined properties', () => {
    const a = { 'x/b': 1, 'x/a': { q: [1, undefined, 2], p: undefined } };
    const b = { 'x/a': { p: undefined, q: [1, undefined, 2] }, 'x/b': 1 };
    expect(canonicalRoomJson(a)).toBe(canonicalRoomJson(b));
    expect(canonicalRoomJson(a)).toBe('{"x/a":{"q":[1,null,2]},"x/b":1}');
    expect(hashRoomState(a)).toBe(hashRoomState(b));
  });

  test('mirrors JSON.stringify edge cases', () => {
    expect(canonicalRoomJson(undefined)).toBe('null');
    expect(canonicalRoomJson(Number.NaN)).toBe('null');
    expect(canonicalRoomJson(-0)).toBe('0');
    expect(canonicalRoomJson([() => 1])).toBe('[null]');
    expect(canonicalRoomJson({ f: () => 1, k: 'v' })).toBe('{"k":"v"}');
    expect(canonicalRoomJson(new Date(0))).toBe('{}');
    expect(canonicalRoomJson(JSON.parse('{"__proto__":1,"a":2}'))).toBe(
      '{"__proto__":1,"a":2}'
    );
  });
});
