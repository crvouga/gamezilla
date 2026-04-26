/**
 * Local API preview origin (must match wrangler dev port in @gamezilla/api).
 * Injected as `API_URL` for @gamezilla/client#setup when unset (e.g. CI Playwright).
 * `.mjs` so Playwright (Node) and Bun tests can share one definition without TS transform.
 */
export const LOCAL_API_PREVIEW_ORIGIN = 'http://127.0.0.1:8788';
