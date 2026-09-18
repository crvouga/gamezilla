/**
 * Endpoint paths mirroring Google's OAuth 2.0 / OpenID Connect surface.
 *
 * Google splits these across three hosts (`accounts.google.com`,
 * `oauth2.googleapis.com`, `openidconnect.googleapis.com`); the simulated IdP
 * serves every path from one origin so a relying party only has to repoint
 * three URLs. Path shapes are kept byte-identical so recorded traffic, logs,
 * and route assertions read the same as production.
 */

export const IDP_AUTHORIZE_PATH = '/o/oauth2/v2/auth';
/** Form target the authorize page posts back to (internal to this IdP). */
export const IDP_AUTHORIZE_SUBMIT_PATH = '/o/oauth2/v2/auth/submit';
/** "Welcome" step of the two-step sign-in; also a GET route, for refreshes. */
export const IDP_AUTHORIZE_PASSWORD_PATH = '/o/oauth2/v2/auth/password';
/** Screen behind "Create account"; a GET link off the sign-in / chooser page. */
export const IDP_AUTHORIZE_CREATE_PATH = '/o/oauth2/v2/auth/create';
/** Back arrow on the screens that are not the first step (internal to this IdP). */
export const IDP_AUTHORIZE_BACK_PATH = '/o/oauth2/v2/auth/back';
export const IDP_TOKEN_PATH = '/token';
export const IDP_USERINFO_PATH = '/v1/userinfo';
export const IDP_CERTS_PATH = '/oauth2/v3/certs';
export const IDP_REVOKE_PATH = '/revoke';
export const IDP_TOKENINFO_PATH = '/tokeninfo';
export const IDP_DISCOVERY_PATH = '/.well-known/openid-configuration';
/** Built SPA assets served from the embedded bundle (internal to this IdP). */
export const IDP_ASSETS_PREFIX = '/idp-assets';
export const IDP_ASSET_JS_PATH = `${IDP_ASSETS_PREFIX}/app.js`;
export const IDP_ASSET_CSS_PATH = `${IDP_ASSETS_PREFIX}/app.css`;
export const IDP_FAVICON_PATH = `${IDP_ASSETS_PREFIX}/favicon.svg`;

/** Test-only control plane. Never mounted by a real provider. */
export const IDP_ADMIN_PREFIX = '/__idp';

/** Browser session cookie. `Secure`-prefixed names cannot ride plain loopback. */
export const IDP_SESSION_COOKIE = 'IDP_SID';

export function idpEndpoints(origin: string): {
  readonly authorizeUrl: string;
  readonly tokenUrl: string;
  readonly userinfoUrl: string;
} {
  const base = origin.replace(/\/$/, '');
  return {
    authorizeUrl: `${base}${IDP_AUTHORIZE_PATH}`,
    tokenUrl: `${base}${IDP_TOKEN_PATH}`,
    userinfoUrl: `${base}${IDP_USERINFO_PATH}`,
  };
}
