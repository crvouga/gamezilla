import { describe, expect, test } from 'bun:test';

import {
  createDefaultAvatarConfig,
  DEFAULT_AVATAR_STYLE,
  parseAvatarConfig,
  serializeAvatarConfig,
  serializeDefaultAvatarConfig,
} from '../../public/avatar-config';

describe('createDefaultAvatarConfig', () => {
  test('uses profile entity id as seed and default style', () => {
    const id = '00000000-0000-4000-8000-00000000a001';
    const c = createDefaultAvatarConfig(id);
    expect(c.style).toBe(DEFAULT_AVATAR_STYLE);
    expect(c.seed).toBe(id);
    expect(c.options).toEqual({});
  });

  test('serializeDefaultAvatarConfig round-trips', () => {
    const id = '00000000-0000-4000-8000-00000000b002';
    const json = serializeDefaultAvatarConfig(id);
    const parsed = parseAvatarConfig(json);
    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(createDefaultAvatarConfig(id));
    expect(serializeAvatarConfig(parsed!)).toBe(json);
  });
});
