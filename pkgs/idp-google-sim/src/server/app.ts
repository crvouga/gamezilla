/**
 * The IdP's Hono app.
 *
 * Built in one chained expression so `ReturnType<typeof createIdpApp>` carries
 * every route, and it is returned **without** a widened `Hono` annotation: that
 * type is the RPC contract the browser app types its client against
 * (`hc<IdpAppType>`), exactly as `apps/server` exposes `AppType`.
 */

import { Hono } from 'hono';

import {
  IDP_ADMIN_PREFIX,
  IDP_ASSET_CSS_PATH,
  IDP_ASSET_JS_PATH,
  IDP_AUTHORIZE_BACK_PATH,
  IDP_AUTHORIZE_CREATE_PATH,
  IDP_AUTHORIZE_PASSWORD_PATH,
  IDP_AUTHORIZE_PATH,
  IDP_AUTHORIZE_SUBMIT_PATH,
  IDP_CERTS_PATH,
  IDP_DISCOVERY_PATH,
  IDP_FAVICON_PATH,
  IDP_REVOKE_PATH,
  IDP_TOKEN_PATH,
  IDP_TOKENINFO_PATH,
  IDP_USERINFO_PATH,
} from '../shared/paths';
import type { IdpCtx } from './idp-context';
import { createIdpAdminApp } from './routes/admin';
import { handleIdpAsset } from './routes/assets';
import {
  handleAuthorize,
  handleAuthorizeBack,
  handleAuthorizeCreate,
  handleAuthorizePassword,
  handleAuthorizeSubmit,
} from './routes/authorize';
import { handleCerts, handleDiscovery } from './routes/discovery';
import { createScreenRpcApp } from './routes/screen-rpc';
import { handleToken } from './routes/token';
import {
  handleRevoke,
  handleTokenInfo,
  handleUserinfo,
} from './routes/userinfo';

export function createIdpApp(ctx: IdpCtx) {
  return new Hono()
    .get(IDP_DISCOVERY_PATH, (c) => handleDiscovery(c, ctx))
    .get(IDP_CERTS_PATH, (c) => handleCerts(c, ctx))
    .get(IDP_AUTHORIZE_PATH, (c) => handleAuthorize(c, ctx))
    .get(IDP_AUTHORIZE_PASSWORD_PATH, (c) => handleAuthorizePassword(c, ctx))
    .get(IDP_AUTHORIZE_CREATE_PATH, (c) => handleAuthorizeCreate(c, ctx))
    .get(IDP_AUTHORIZE_BACK_PATH, (c) => handleAuthorizeBack(c, ctx))
    .get(IDP_ASSET_JS_PATH, (c) => handleIdpAsset(c))
    .get(IDP_ASSET_CSS_PATH, (c) => handleIdpAsset(c))
    .get(IDP_FAVICON_PATH, (c) => handleIdpAsset(c))
    .post(IDP_AUTHORIZE_SUBMIT_PATH, (c) => handleAuthorizeSubmit(c, ctx))
    .route('/rpc', createScreenRpcApp(ctx))
    .post(IDP_TOKEN_PATH, (c) => handleToken(c, ctx))
    .get(IDP_USERINFO_PATH, (c) => handleUserinfo(c, ctx))
    .post(IDP_USERINFO_PATH, (c) => handleUserinfo(c, ctx))
    .get(IDP_TOKENINFO_PATH, (c) => handleTokenInfo(c, ctx))
    .post(IDP_REVOKE_PATH, (c) => handleRevoke(c, ctx));
}

/** The app plus the test-only control plane, when the caller wants it. */
export function createIdpAppWithAdmin(ctx: IdpCtx) {
  return createIdpApp(ctx).route(IDP_ADMIN_PREFIX, createIdpAdminApp(ctx));
}

/** The RPC contract: `import type { IdpAppType }` in the browser app. */
export type IdpAppType = ReturnType<typeof createIdpAppWithAdmin>;
