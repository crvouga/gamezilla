/** Everything a route handler needs: the store, the issuer source, egress. */

import type { HttpClient } from '@pkgs/http-client';
import type { Context } from 'hono';

import type { IdpStore } from './idp-state';

export type IdpCtx = {
  readonly store: IdpStore;
  /**
   * Fixed issuer, or `null` to derive it from the inbound request. Deriving is
   * what makes an OS-assigned port work without anyone configuring an origin.
   */
  readonly issuerOverride: string | null;
  /**
   * Outbound HTTP for provider-initiated calls (Apple's server-to-server
   * notifications). `null` means the provider cannot reach anyone, and an
   * event that would have been delivered is reported as undeliverable.
   */
  readonly http: HttpClient | null;
};

export function issuerOf(ctx: IdpCtx, c: Context): string {
  if (ctx.issuerOverride !== null) return ctx.issuerOverride.replace(/\/$/, '');
  return new URL(c.req.url).origin;
}
