/**
 * A simulated Google identity provider.
 *
 * It is a whole provider, not a stub: its own account directory, its own
 * browser sessions, its own consent grants, its own signing keys, and the
 * real screens in between. A relying party talks to it over the documented
 * Google endpoints and cannot tell the difference without looking at the
 * origin — which is the point, because the production code path (PKCE, code
 * exchange, userinfo) is then the code path under test.
 *
 * All I/O is injected, so the same app runs in-process inside a simulation
 * and standalone on a loopback port.
 */

import { Hono } from 'hono';

import {
  IDP_ADMIN_PREFIX,
  IDP_AUTHORIZE_PATH,
  IDP_AUTHORIZE_SUBMIT_PATH,
  IDP_CERTS_PATH,
  IDP_DISCOVERY_PATH,
  IDP_REVOKE_PATH,
  IDP_TOKEN_PATH,
  IDP_TOKENINFO_PATH,
  IDP_USERINFO_PATH,
} from '../shared/paths';
import type { IdpAccount, IdpClient } from '../shared/types';
import type { IdpCtx } from './idp-context';
import type { IdpSigningKeys } from './idp-keys';
import { type IdpAccountDraft, upsertAccount } from './idp-seed';
import { createIdpState, type IdpStateDeps } from './idp-state';
import { createIdpAdminApp } from './routes/admin';
import { handleAuthorize, handleAuthorizeSubmit } from './routes/authorize';
import { handleCerts, handleDiscovery } from './routes/discovery';
import { handleToken } from './routes/token';
import {
  handleRevoke,
  handleTokenInfo,
  handleUserinfo,
} from './routes/userinfo';

export type CreateIdpAppDeps = IdpStateDeps & {
  readonly keys: IdpSigningKeys;
  /** OAuth clients this provider will serve. */
  readonly clients: readonly IdpClient[];
  /** Directory contents at boot. */
  readonly accounts?: readonly IdpAccountDraft[];
  /** Pin the issuer instead of deriving it from the request origin. */
  readonly issuer?: string;
  /** Mount the test-only `/__idp` control plane. Default `true`. */
  readonly admin?: boolean;
};

export type GoogleIdp = {
  readonly app: Hono;
  readonly ctx: IdpCtx;
  /** Add (or replace) a directory entry after boot. */
  addAccount(draft: IdpAccountDraft): IdpAccount;
};

export function createGoogleIdpApp(deps: CreateIdpAppDeps): GoogleIdp {
  const state = createIdpState({ clock: deps.clock, createId: deps.createId });
  for (const client of deps.clients) state.clients.set(client.clientId, client);
  for (const draft of deps.accounts ?? []) upsertAccount(state, draft);

  const ctx: IdpCtx = {
    state,
    keys: deps.keys,
    issuerOverride: deps.issuer ?? null,
  };

  const app = new Hono();
  app.get(IDP_DISCOVERY_PATH, (c) => handleDiscovery(c, ctx));
  app.get(IDP_CERTS_PATH, (c) => handleCerts(c, ctx));
  app.get(IDP_AUTHORIZE_PATH, (c) => handleAuthorize(c, ctx));
  app.post(IDP_AUTHORIZE_SUBMIT_PATH, (c) => handleAuthorizeSubmit(c, ctx));
  app.post(IDP_TOKEN_PATH, (c) => handleToken(c, ctx));
  app.get(IDP_USERINFO_PATH, (c) => handleUserinfo(c, ctx));
  app.post(IDP_USERINFO_PATH, (c) => handleUserinfo(c, ctx));
  app.get(IDP_TOKENINFO_PATH, (c) => handleTokenInfo(c, ctx));
  app.post(IDP_REVOKE_PATH, (c) => handleRevoke(c, ctx));
  if (deps.admin !== false) {
    app.route(IDP_ADMIN_PREFIX, createIdpAdminApp(ctx));
  }

  return {
    app,
    ctx,
    addAccount: (draft) => upsertAccount(state, draft),
  };
}
