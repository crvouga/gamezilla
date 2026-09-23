/**
 * Service-worker caching policy for the super-app shell.
 *
 * First-install precache is capped at 1 MiB, so heavy lazy chunks are excluded
 * from `globIgnores`. Every excluded *chunk* still needs a runtime cache rule —
 * otherwise a post-deploy offline open can fail fetching it. This module keeps
 * the two lists in one place and exposes the invariant the check asserts.
 */

export type LazyShellCacheRule = {
  readonly cacheName: string;
  readonly globs: readonly string[];
  readonly urlPattern: RegExp;
};

/** First-install precache exclusions (assets + heavy lazy chunks). */
export const PRECACHE_GLOB_IGNORES: readonly string[] = [
  '**/apple-splash-*.png',
  '**/generated/**',
  '**/*dicebear*.js',
  '**/*with-framework-mutations*.js',
  '**/*game-plugins*.js',
  '**/*create-local-sync-engine*.js',
  '**/*.map',
];

/** Ignore entries that are never fetched at runtime as shell chunks. */
export const PRECACHE_IGNORE_EXEMPT: readonly string[] = [
  '**/apple-splash-*.png',
  '**/generated/**',
  '**/*.map',
];

export const LAZY_SHELL_CACHE_MAX_AGE_SECONDS = 30 * 24 * 3600;

/** Runtime rules for lazy shell chunks that stay out of first-install precache. */
export const LAZY_SHELL_CACHE_RULES: readonly LazyShellCacheRule[] = [
  {
    cacheName: 'lazy-shell-dicebear',
    globs: ['**/*dicebear*.js'],
    urlPattern: /dicebear[^/]*\.js$/,
  },
  {
    cacheName: 'lazy-shell-mutations',
    globs: ['**/*with-framework-mutations*.js'],
    urlPattern: /with-framework-mutations[^/]*\.js$/,
  },
  {
    cacheName: 'lazy-shell-game-plugins',
    globs: ['**/*game-plugins*.js'],
    urlPattern: /game-plugins[^/]*\.js$/,
  },
  {
    cacheName: 'lazy-shell-sync-engine',
    globs: ['**/*create-local-sync-engine*.js'],
    urlPattern: /create-local-sync-engine[^/]*\.js$/,
  },
];

/** Ignore entries that no rule covers and that are not explicitly exempt. */
export function uncoveredLazyShellIgnores(args: {
  readonly ignores: readonly string[];
  readonly exempt: readonly string[];
  readonly rules: readonly LazyShellCacheRule[];
}): readonly string[] {
  const exempt = new Set(args.exempt);
  const covered = new Set(args.rules.flatMap((rule) => rule.globs));
  return args.ignores.filter(
    (entry) => !exempt.has(entry) && !covered.has(entry)
  );
}
