import { describe, expect, test } from 'bun:test';

import {
  configsEqual,
  DEFAULT_AVATAR_STYLE,
  parseAvatarConfig,
  serializeAvatarConfig,
} from '@libs/profile/public/avatar-config';

describe('avatar config spec values', () => {
  test('pins the default DiceBear style', () => {
    expect(DEFAULT_AVATAR_STYLE).toBe('funEmoji');
  });
});

describe('avatar config canonical serialization', () => {
  // regression: avatar-array-key-order
  test('objects nested in option arrays serialize with sorted keys', () => {
    const a = { style: 's', seed: 'x', options: { a: [{ a: 1, b: 2 }] } };
    const b = { style: 's', seed: 'x', options: { a: [{ b: 2, a: 1 }] } };
    expect(serializeAvatarConfig(b)).toBe(serializeAvatarConfig(a));
    expect(configsEqual(a, b)).toBe(true);
  });

  // regression: avatar-proto-key
  test('an own `__proto__` option key survives serialization', () => {
    const wire =
      '{"style":"s","seed":"x","options":{"__proto__":{"a":1},"b":2}}';
    const parsed = parseAvatarConfig(wire);
    expect(parsed).not.toBeNull();
    expect(serializeAvatarConfig(parsed as NonNullable<typeof parsed>)).toBe(
      wire
    );
  });
});
