import { describe, expect, test } from 'bun:test';
import { arbJsonValue, assertProperty, fc } from '@pkgs/pbt';
import { canonicalRoomJson, hashRoomState } from './hash-room-state';
import { arbKeyOrderPair } from './tests/arbitraries/room-json';

describe('hashRoomState properties', () => {
  test('key insertion order does not change the digest', () => {
    assertProperty(
      'hashRoomState ignores object key insertion order',
      fc.property(arbKeyOrderPair(), ({ a, b }) => {
        expect(hashRoomState(a as never)).toBe(hashRoomState(b as never));
        expect(canonicalRoomJson(a)).toBe(canonicalRoomJson(b));
      }),
      {
        examples: [[{ a: { x: 1, y: 2, z: 3 }, b: { z: 3, y: 2, x: 1 } }]],
      }
    );
  });

  test('array order is significant', () => {
    assertProperty(
      'hashRoomState treats array order as significant',
      fc.property(
        fc.array(arbJsonValue(2), { minLength: 2, maxLength: 6 }),
        (items) => {
          const reversed = [...items].reverse();
          fc.pre(canonicalRoomJson(items) !== canonicalRoomJson(reversed));
          expect(hashRoomState({ xs: items } as never)).not.toBe(
            hashRoomState({ xs: reversed } as never)
          );
        }
      )
    );
  });

  test('integer-like string keys: insertion order does not change the digest', () => {
    assertProperty(
      'integer-like keys hash equal across insertion order',
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 99 }), {
          minLength: 2,
          maxLength: 6,
        }),
        (nums) => {
          const keys = nums.map(String);
          const a: Record<string, unknown> = {};
          const b: Record<string, unknown> = {};
          for (const k of keys) a[k] = Number(k);
          for (const k of [...keys].reverse()) b[k] = Number(k);
          // JSON.stringify reorders integer-like keys in the output string;
          // sorted-key copy still makes the digest insertion-order independent.
          expect(hashRoomState(a as never)).toBe(hashRoomState(b as never));
          expect(canonicalRoomJson(a)).toBe(canonicalRoomJson(b));
        }
      ),
      {
        examples: [[[2, 10, 1]]],
      }
    );
  });
});
