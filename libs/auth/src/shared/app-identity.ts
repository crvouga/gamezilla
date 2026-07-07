/**
 * Single source of truth for the product's identity strings.
 *
 * Co-located in `@libs/auth` because auth owns the deep-link `scheme` and the
 * product display name, and auth sits low in the dependency graph (every
 * surface that needs identity already depends on it, with no cycle).
 *
 * `apps/client/app.json` (Expo `name` / `slug` / `scheme`) must be kept in
 * sync with these values by hand — Expo requires static JSON, so it cannot
 * import this module at config-resolution time.
 */
export const APP_IDENTITY = {
  /** Human-facing product name (titles, auth app name fallback). */
  displayName: 'Gamezilla',
  /** Lowercase identifier (Expo slug, secure-storage prefix). */
  slug: 'gamezilla',
  /** Mobile deep-link scheme (`scheme://`). */
  urlScheme: 'gamezilla',
  /** Root domain for deployed surfaces. */
  domain: 'gamezilla.app',
  /** Production API origin hostname (same host as the web client). */
  apiHost: 'www.gamezilla.app',
} as const;

/** Mobile deep-link origin, e.g. `gamezilla://`. */
export function appDeepLinkOrigin(): string {
  return `${APP_IDENTITY.urlScheme}://`;
}
