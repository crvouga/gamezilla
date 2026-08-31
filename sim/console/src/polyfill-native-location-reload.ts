// @io-wall-ok
/**
 * Intentionally empty.
 *
 * Do **not** polyfill `globalThis.location` / `window.location` on native.
 * Expo's `buildUrlForBundle` prefers `location.origin` when `location` is
 * defined; a stub origin (e.g. `http://sim.local`) makes async `import()`
 * chunks request the wrong host → `Could not load bundle`.
 *
 * Expo HMR may still call `window.location.reload()` when Metro disconnects;
 * that surfaces as a clear TypeError — restart bun dev / hard-reload Expo Go.
 */
export function polyfillNativeLocationReload(): void {
  // no-op — see file comment
}
