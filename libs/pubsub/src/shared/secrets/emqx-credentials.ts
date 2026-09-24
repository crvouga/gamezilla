import {
  EMQX_API_KEY,
  EMQX_API_SECRET,
  EMQX_DASHBOARD_PASS,
  EMQX_JWT_SECRET,
} from '@pkgs/emqx-server/ports';

/** EMQX's stock dashboard password on a fresh node. */
export const EMQX_STOCK_DASHBOARD_PASSWORD = 'public';

/**
 * Broker credentials committed to git for the local EMQX sidecar. They are
 * public, so the Railway broker must never run on them: provision rotates any
 * stored value found here, and `@libs/pubsub#health` fails on them.
 */
export const COMMITTED_EMQX_CREDENTIALS: ReadonlySet<string> = new Set([
  EMQX_API_KEY,
  EMQX_API_SECRET,
  EMQX_JWT_SECRET,
  EMQX_DASHBOARD_PASS,
  EMQX_STOCK_DASHBOARD_PASSWORD,
]);

export function isUnusableEmqxCredential(value: string | undefined): boolean {
  const v = value?.trim() ?? '';
  return v.length === 0 || COMMITTED_EMQX_CREDENTIALS.has(v);
}
