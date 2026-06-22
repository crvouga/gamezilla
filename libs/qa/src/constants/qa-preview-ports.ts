/**
 * Dedicated loopback ports for Playwright `turbo preview` so `qa:browser` never
 * collides with `bun run dev` (:5173) or Expo Metro (:5174). Reusing the dev
 * port makes Playwright treat the SPA fallback on `/ready` as "server up" while
 * OAuth and dev-idp are absent or stale.
 */
export const QA_PREVIEW_PORT = 5175;

/** Dev IdP port for the QA preview stack — avoids a zombie `bun dev` IdP on :5556. */
export const QA_DEV_IDP_PORT = 5557;

export const QA_PREVIEW_BASE_URL = `http://localhost:${String(QA_PREVIEW_PORT)}`;
