/**
 * Endpoint paths mirroring each provider's OAuth 2.0 / OpenID Connect surface.
 *
 * Google splits these across three hosts (`accounts.google.com`,
 * `oauth2.googleapis.com`, `openidconnect.googleapis.com`); Apple serves
 * everything from `appleid.apple.com`. The simulated IdP serves every path
 * from its one origin, so a relying party only has to repoint a base URL.
 * Path shapes are kept byte-identical so recorded traffic, logs, and route
 * assertions read the same as production.
 *
 * The screens' own step routes (password, create, back, submit) are internal
 * to the mock and shared by both flavors.
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

/** Apple: `https://appleid.apple.com/auth/*`. There is no userinfo endpoint. */
export const APPLE_AUTHORIZE_PATH = '/auth/authorize';
export const APPLE_TOKEN_PATH = '/auth/token';
export const APPLE_KEYS_PATH = '/auth/keys';
export const APPLE_REVOKE_PATH = '/auth/revoke';
/**
 * The `aud` Apple requires in a relying party's `client_secret` JWT. It is
 * the production issuer string whatever origin the mock is served from —
 * Apple checks the literal, and so does this mock.
 */
export const APPLE_CLIENT_SECRET_AUDIENCE = 'https://appleid.apple.com';

/** Test-only control plane. Never mounted by a real provider. */
export const IDP_ADMIN_PREFIX = '/__idp';

/** Browser session cookie. `Secure`-prefixed names cannot ride plain loopback. */
export const IDP_SESSION_COOKIE = 'IDP_SID';

export function idpEndpoints(origin: string): {
  readonly authorizeUrl: string;
  readonly tokenUrl: string;
  readonly userinfoUrl: string;
  readonly jwksUrl: string;
  readonly revokeUrl: string;
} {
  const base = origin.replace(/\/$/, '');
  return {
    authorizeUrl: `${base}${IDP_AUTHORIZE_PATH}`,
    tokenUrl: `${base}${IDP_TOKEN_PATH}`,
    userinfoUrl: `${base}${IDP_USERINFO_PATH}`,
    jwksUrl: `${base}${IDP_CERTS_PATH}`,
    revokeUrl: `${base}${IDP_REVOKE_PATH}`,
  };
}

export function appleEndpoints(origin: string): {
  readonly authorizeUrl: string;
  readonly tokenUrl: string;
  readonly jwksUrl: string;
  readonly revokeUrl: string;
} {
  const base = origin.replace(/\/$/, '');
  return {
    authorizeUrl: `${base}${APPLE_AUTHORIZE_PATH}`,
    tokenUrl: `${base}${APPLE_TOKEN_PATH}`,
    jwksUrl: `${base}${APPLE_KEYS_PATH}`,
    revokeUrl: `${base}${APPLE_REVOKE_PATH}`,
  };
}
