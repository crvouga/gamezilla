/**
 * A simulated identity provider — Google-flavored or Apple-flavored.
 *
 * It is a whole provider, not a stub: its own account directory, its own
 * browser sessions, its own consent grants, its own signing keys, and the
 * real screens in between. A relying party talks to it over the documented
 * endpoints of the provider it imitates and cannot tell the difference
 * without looking at the origin — which is the point, because the
 * production code path (PKCE or client-secret JWTs, code exchange, userinfo
 * or id_token verification, form_post callbacks) is then the path under test.
 *
 * Every piece of state lives in the injected {@link IdpStore}; the same app
 * runs in-process inside a simulation and standalone on a loopback port. The
 * app itself is assembled in `app.ts`, whose return type is the RPC contract.
 */

import type { HttpClient } from '@pkgs/http-client';
import type { Hono } from 'hono';

import type { IdpAccount, IdpAccountDraft, IdpClient } from '../shared/types';
import { createIdpApp, createIdpAppWithAdmin } from './app';
import type { IdpCtx } from './idp-context';
import type { IdpStore } from './idp-state';

export type CreateIdpAppOptions = {
  /** Migrated, bootstrapped IdP storage. */
  readonly store: IdpStore;
  /** OAuth clients this provider will serve. */
  readonly clients: readonly IdpClient[];
  /**
   * Directory contents at boot. Seeded, not upserted: a restart never rewrites
   * an account that was created or edited in the running provider.
   */
  readonly accounts?: readonly IdpAccountDraft[];
  /** Pin the issuer instead of deriving it from the request origin. */
  readonly issuer?: string;
  /** Mount the test-only `/__idp` control plane. Default `true`. */
  readonly admin?: boolean;
  /**
   * Egress for provider-initiated calls (Apple's server-to-server
   * notifications). Omit it and events are recorded as undeliverable.
   */
  readonly http?: HttpClient;
};

export type IdpSim = {
  readonly app: Hono;
  readonly ctx: IdpCtx;
  /** Add (or replace) a directory entry after boot. */
  addAccount(draft: IdpAccountDraft): Promise<IdpAccount>;
};

export async function createIdpSimApp(
  options: CreateIdpAppOptions
): Promise<IdpSim> {
  const { store } = options;
  for (const client of options.clients) {
    await store.registerClient(client);
  }
  for (const draft of options.accounts ?? []) {
    await store.seedAccount(draft);
  }

  const ctx: IdpCtx = {
    store,
    issuerOverride: options.issuer ?? null,
    http: options.http ?? null,
  };
  const app =
    options.admin === false ? createIdpApp(ctx) : createIdpAppWithAdmin(ctx);

  return {
    app,
    ctx,
    addAccount: (draft) => store.upsertAccount(draft),
  };
}
