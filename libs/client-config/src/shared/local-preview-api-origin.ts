/**
 * Loopback origin for `wrangler dev` in this repo (`apps/api` uses port 8788).
 * Used when `LOCAL_PREVIEW_API_ORIGIN` is unset in env and absent or blank in Vault.
 */
export const DEFAULT_LOCAL_PREVIEW_API_ORIGIN =
  'http://127.0.0.1:8788' as const;
