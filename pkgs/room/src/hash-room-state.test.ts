import { describe, expect, test } from 'bun:test';
import { asKeyword } from '@pkgs/keyword';

import {
  canonicalRoomJson,
  fnv1a64Hex,
  hashRoomState,
} from './hash-room-state';
import type { RoomState } from './types';

describe('hashRoomState', () => {
  test('canonical JSON sorts object keys recursively', () => {
    expect(canonicalRoomJson({ b: 1, a: { z: 2, y: 3 } })).toBe(
      '{"a":{"y":3,"z":2},"b":1}'
    );
  });

  test('__proto__ own key is preserved in the digest', () => {
    const withProto = Object.defineProperty(
      {} as Record<string, unknown>,
      '__proto__',
      {
        value: { a: 1 },
        enumerable: true,
        configurable: true,
        writable: true,
      }
    );
    expect(canonicalRoomJson(withProto)).toBe('{"__proto__":{"a":1}}');
    expect(hashRoomState(withProto as RoomState)).not.toBe(
      hashRoomState({} as RoomState)
    );
  });

  test('equivalent states with different key insertion order share a hash', () => {
    const ka = asKeyword('test/alpha');
    const kz = asKeyword('test/zeta');
    const a: RoomState = { [kz]: 1, [ka]: 'x' };
    const b: RoomState = { [ka]: 'x', [kz]: 1 };
    expect(hashRoomState(a)).toBe(hashRoomState(b));
    expect(hashRoomState(a)).toBe(
      fnv1a64Hex('{"test/alpha":"x","test/zeta":1}')
    );
  });
});
