/**
 * The IdP's Hono app: the flavor's protocol surface, plus the screens and
 * their RPC, which both flavors share.
 *
 * Built in one chained expression so `ReturnType<typeof createIdpApp>` carries
 * every route, and it is returned **without** a widened `Hono` annotation: that
 * type is the RPC contract the browser app types its client against
 * (`hc<IdpAppType>`), exactly as `apps/server` exposes `AppType`.
 */

import { Hono } from 'hono';

import {
  APPLE_AUTHORIZE_PATH,
  APPLE_KEYS_PATH,
  APPLE_REVOKE_PATH,
  APPLE_TOKEN_PATH,
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
import { handleAppleRevoke } from './routes/apple-revoke';
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

/** Google's documented surface, byte-identical paths. */
function googleProtocol(ctx: IdpCtx): Hono {
  return new Hono()
    .get(IDP_DISCOVERY_PATH, (c) => handleDiscovery(c, ctx))
    .get(IDP_CERTS_PATH, (c) => handleCerts(c, ctx))
    .get(IDP_AUTHORIZE_PATH, (c) => handleAuthorize(c, ctx))
    .post(IDP_TOKEN_PATH, (c) => handleToken(c, ctx))
    .get(IDP_USERINFO_PATH, (c) => handleUserinfo(c, ctx))
    .post(IDP_USERINFO_PATH, (c) => handleUserinfo(c, ctx))
    .get(IDP_TOKENINFO_PATH, (c) => handleTokenInfo(c, ctx))
    .post(IDP_REVOKE_PATH, (c) => handleRevoke(c, ctx));
}

/** Apple's `appleid.apple.com/auth/*` surface. There is no userinfo. */
function appleProtocol(ctx: IdpCtx): Hono {
  return new Hono()
    .get(IDP_DISCOVERY_PATH, (c) => handleDiscovery(c, ctx))
    .get(APPLE_KEYS_PATH, (c) => handleCerts(c, ctx))
    .get(APPLE_AUTHORIZE_PATH, (c) => handleAuthorize(c, ctx))
    .post(APPLE_TOKEN_PATH, (c) => handleToken(c, ctx))
    .post(APPLE_REVOKE_PATH, (c) => handleAppleRevoke(c, ctx));
}

export function createIdpApp(ctx: IdpCtx) {
  const protocol =
    ctx.store.provider === 'apple' ? appleProtocol(ctx) : googleProtocol(ctx);
  return new Hono()
    .route('/', protocol)
    .get(IDP_AUTHORIZE_PASSWORD_PATH, (c) => handleAuthorizePassword(c, ctx))
    .get(IDP_AUTHORIZE_CREATE_PATH, (c) => handleAuthorizeCreate(c, ctx))
    .get(IDP_AUTHORIZE_BACK_PATH, (c) => handleAuthorizeBack(c, ctx))
    .get(IDP_ASSET_JS_PATH, (c) => handleIdpAsset(c))
    .get(IDP_ASSET_CSS_PATH, (c) => handleIdpAsset(c))
    .get(IDP_FAVICON_PATH, (c) => handleIdpAsset(c))
    .post(IDP_AUTHORIZE_SUBMIT_PATH, (c) => handleAuthorizeSubmit(c, ctx))
    .route('/rpc', createScreenRpcApp(ctx));
}

/** The app plus the test-only control plane, when the caller wants it. */
export function createIdpAppWithAdmin(ctx: IdpCtx) {
  return createIdpApp(ctx).route(IDP_ADMIN_PREFIX, createIdpAdminApp(ctx));
}

/** The RPC contract: `import type { IdpAppType }` in the browser app. */
export type IdpAppType = ReturnType<typeof createIdpAppWithAdmin>;
