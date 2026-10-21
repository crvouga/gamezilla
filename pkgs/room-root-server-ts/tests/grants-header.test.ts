import { describe, expect, test } from 'bun:test';
import {
  decodeRoomGrants,
  encodeRoomGrants,
} from '@pkgs/room-root-server-ts/grants-header';

describe('room grants header', () => {
  test('round-trips the grants a gateway decided', () => {
    const grants = ['spaces:select-game', 'tally'];
    expect(decodeRoomGrants(encodeRoomGrants(grants))).toEqual(grants);
  });

  test('absent or empty is no grants', () => {
    expect(decodeRoomGrants(null)).toEqual([]);
    expect(decodeRoomGrants('')).toEqual([]);
    expect(encodeRoomGrants([])).toBe('');
  });

  test('a grant that would split or blur the header is refused', () => {
    expect(() => encodeRoomGrants(['a,b'])).toThrow();
    expect(() => encodeRoomGrants(['a b'])).toThrow();
    expect(() => encodeRoomGrants([''])).toThrow();
  });
});
