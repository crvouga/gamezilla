import { describe, expect, test } from 'bun:test';

import {
  resolveSpaceFallbackTitleParts,
  SPACE_ID_TITLE_SUFFIX_LENGTH,
} from './resolve-space-fallback-title-parts';

describe('resolveSpaceFallbackTitleParts', () => {
  test('uses host name when non-empty', () => {
    expect(resolveSpaceFallbackTitleParts('alice', 'space-abcdefgh')).toEqual({
      kind: 'host',
      hostName: 'alice',
    });
  });

  test('falls back to id suffix when username null', () => {
    expect(resolveSpaceFallbackTitleParts(null, 'space-abcdefgh')).toEqual({
      kind: 'id',
      suffix: 'abcdefgh',
    });
  });

  test('falls back to id suffix when username empty', () => {
    expect(resolveSpaceFallbackTitleParts('', '12345678xxxxxxxx')).toEqual({
      kind: 'id',
      suffix: 'xxxxxxxx',
    });
  });

  test('suffix length is SPACE_ID_TITLE_SUFFIX_LENGTH', () => {
    const parts = resolveSpaceFallbackTitleParts(null, 'abcdef');
    expect(parts.kind).toBe('id');
    if (parts.kind === 'id') {
      expect(parts.suffix.length).toBeLessThanOrEqual(
        SPACE_ID_TITLE_SUFFIX_LENGTH
      );
    }
  });
});
