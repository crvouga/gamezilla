/** Everything a route handler needs: the store and the issuer source. */

import type { Context } from 'hono';

import type { IdpStore } from './idp-state';

export type IdpCtx = {
  readonly store: IdpStore;
  /**
   * Fixed issuer, or `null` to derive it from the inbound request. Deriving is
   * what makes an OS-assigned port work without anyone configuring an origin.
   */
  readonly issuerOverride: string | null;
};

export function issuerOf(ctx: IdpCtx, c: Context): string {
  if (ctx.issuerOverride !== null) return ctx.issuerOverride.replace(/\/$/, '');
  return new URL(c.req.url).origin;
}
