import { describe, expect, test } from 'bun:test';

import { resolveSpaceFallbackTitleParts } from './resolve-space-fallback-title-parts';

describe('resolveSpaceFallbackTitleParts', () => {
  test('uses host name when non-empty', () => {
    expect(resolveSpaceFallbackTitleParts('alice')).toEqual({
      kind: 'host',
      hostName: 'alice',
    });
  });

  test('falls back to generic when username null or empty', () => {
    expect(resolveSpaceFallbackTitleParts(null)).toEqual({ kind: 'generic' });
    expect(resolveSpaceFallbackTitleParts('')).toEqual({ kind: 'generic' });
  });
});
