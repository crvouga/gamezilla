/**
 * Loopback origin for `wrangler dev` in this repo (`apps/api` uses port 8788).
 * Used when `LOCAL_PREVIEW_API_ORIGIN` is unset in env and absent or blank in the secret store.
 */
export const DEFAULT_LOCAL_PREVIEW_API_ORIGIN =
  'http://localhost:8788' as const;
