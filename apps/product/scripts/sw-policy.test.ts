// goal:works-offline:1
import { describe, expect, test } from 'bun:test';

import {
  LAZY_SHELL_CACHE_RULES,
  PRECACHE_GLOB_IGNORES,
  PRECACHE_IGNORE_EXEMPT,
  uncoveredLazyShellIgnores,
} from './sw-policy';

describe('service worker caching policy', () => {
  test('every precache exclusion is exempt or runtime-cached', () => {
    expect(
      uncoveredLazyShellIgnores({
        ignores: PRECACHE_GLOB_IGNORES,
        exempt: PRECACHE_IGNORE_EXEMPT,
        rules: LAZY_SHELL_CACHE_RULES,
      })
    ).toEqual([]);
  });

  test('every runtime rule covers a precache exclusion', () => {
    for (const rule of LAZY_SHELL_CACHE_RULES) {
      for (const glob of rule.globs) {
        expect(PRECACHE_GLOB_IGNORES).toContain(glob);
        expect(PRECACHE_IGNORE_EXEMPT).not.toContain(glob);
      }
    }
  });

  test('the lazy shell chunks stay out of first-install precache', () => {
    expect(PRECACHE_GLOB_IGNORES).toContain('**/*create-local-sync-engine*.js');
    expect(PRECACHE_GLOB_IGNORES).toContain('**/*with-framework-mutations*.js');
    expect(PRECACHE_GLOB_IGNORES).toContain('**/*game-plugins*.js');
    expect(PRECACHE_GLOB_IGNORES).toContain('**/*dicebear*.js');
  });

  test('an uncovered exclusion is reported', () => {
    expect(
      uncoveredLazyShellIgnores({
        ignores: ['**/*orphan-chunk*.js'],
        exempt: PRECACHE_IGNORE_EXEMPT,
        rules: LAZY_SHELL_CACHE_RULES,
      })
    ).toEqual(['**/*orphan-chunk*.js']);
  });
});
