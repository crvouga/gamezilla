import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import {
  arbJsonKey,
  arbJsonObject,
  arbJsonValue,
} from '@pkgs/property-shared/json';
import {
  canonicalRoomJson,
  fnv1a64Hex,
  hashRoomState,
} from '@pkgs/room-shared/hash-room-state';
import type { RoomState } from '@pkgs/room-shared/types';
import fc from 'fast-check';

/** Rebuild `value` with every object's own keys inserted in the order `keys` dictates. */
function reorderKeys(value: unknown, seed: number): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => reorderKeys(v, seed));
  const entries = Object.entries(value as Record<string, unknown>);
  const shuffled = entries
    .map((e, i) => ({ e, k: (i * 7919 + seed) % 104_729 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.e);
  const out: Record<string, unknown> = {};
  for (const [k, v] of shuffled) {
    Object.defineProperty(out, k, {
      value: reorderKeys(v, seed + 1),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

/** Deep-insert `undefined`-valued keys; canonical form must drop them. */
function withUndefinedKeys(value: unknown, extra: string): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value))
    return value.map((v) => withUndefinedKeys(v, extra));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    Object.defineProperty(out, k, {
      value: withUndefinedKeys(v, extra),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  if (!Object.hasOwn(out, extra)) out[extra] = undefined;
  return out;
}

describe('canonicalRoomJson / hashRoomState properties', () => {
  test('key insertion order never changes the canonical form or hash', () => {
    assertProperty(
      'key-order independence',
      fc.property(arbJsonObject(), fc.nat(), (obj, seed) => {
        const reordered = reorderKeys(obj, seed) as RoomState;
        expect(canonicalRoomJson(reordered)).toBe(canonicalRoomJson(obj));
        expect(hashRoomState(reordered)).toBe(hashRoomState(obj as RoomState));
      })
    );
  });

  test('canonical form is a fixed point of parse → canonicalize', () => {
    assertProperty(
      'idempotence',
      fc.property(arbJsonValue(), (v) => {
        const once = canonicalRoomJson(v);
        expect(canonicalRoomJson(JSON.parse(once))).toBe(once);
      })
    );
  });

  test('array order is significant', () => {
    assertProperty(
      'array order significance',
      fc.property(
        fc.uniqueArray(arbJsonValue(1), {
          minLength: 2,
          maxLength: 5,
          selector: (v) => canonicalRoomJson(v),
        }),
        (items) => {
          const rotated = [...items.slice(1), items[0]];
          expect(canonicalRoomJson(rotated)).not.toBe(canonicalRoomJson(items));
        }
      )
    );
  });

  test('undefined-valued keys are omitted; undefined array slots become null', () => {
    assertProperty(
      'undefined handling',
      fc.property(arbJsonValue(), arbJsonKey(), (v, extra) => {
        expect(canonicalRoomJson(withUndefinedKeys(v, extra))).toBe(
          canonicalRoomJson(v)
        );
        expect(canonicalRoomJson([v, undefined])).toBe(
          canonicalRoomJson([v, null])
        );
      })
    );
  });

  test('hash is a 16-hex-digit FNV-1a digest of the canonical form', () => {
    assertProperty(
      'hash shape',
      fc.property(arbJsonObject(), (obj) => {
        const h = hashRoomState(obj as RoomState);
        expect(h).toMatch(/^[0-9a-f]{16}$/);
        expect(h).toBe(fnv1a64Hex(canonicalRoomJson(obj)));
      })
    );
  });

  test('spec: FNV-1a 64 reference vectors', () => {
    expect(fnv1a64Hex('')).toBe('cbf29ce484222325');
    expect(fnv1a64Hex('a')).toBe('af63dc4c8601ec8c');
    expect(fnv1a64Hex('foobar')).toBe('85944171f73967e8');
  });

  test('spec: a `__proto__` key is hashed as data, not as [[Prototype]]', () => {
    const state = JSON.parse('{"__proto__":{"x":1},"a":2}') as RoomState;
    expect(canonicalRoomJson(state)).toBe('{"__proto__":{"x":1},"a":2}');
  });
});
