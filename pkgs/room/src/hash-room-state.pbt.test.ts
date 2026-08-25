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
      })
    );
  });

  test('array order is significant', () => {
    assertProperty(
      'hashRoomState treats array order as significant',
      fc.property(
        fc.array(arbJsonValue(2), { minLength: 2, maxLength: 6 }),
        (items) => {
          const reversed = [...items].reverse();
          fc.pre(JSON.stringify(items) !== JSON.stringify(reversed));
          expect(hashRoomState({ xs: items } as never)).not.toBe(
            hashRoomState({ xs: reversed } as never)
          );
        }
      )
    );
  });
});
