/** Everything a route handler needs: internal state, signing keys, issuer. */

import type { Context } from 'hono';

import type { IdpSigningKeys } from './idp-keys';
import type { IdpState } from './idp-state';

export type IdpCtx = {
  readonly state: IdpState;
  readonly keys: IdpSigningKeys;
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
