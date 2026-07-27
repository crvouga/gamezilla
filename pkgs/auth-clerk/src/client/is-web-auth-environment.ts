/**
 * True in a browser document (Expo web). False on native / SSR.
 *
 * Do not key off `window.location` alone — Expo native polyfills `window` and
 * a stub `location` (bundler origin) that throws on `assign()`, which wrongly
 * routed native SSO into the same-tab web path.
 */
export function isWebAuthEnvironment(): boolean {
  return typeof document !== 'undefined';
}
