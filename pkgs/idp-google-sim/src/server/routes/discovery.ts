/** Discovery document + JWKS, shaped like Google's. */

import type { Context } from 'hono';

import {
  IDP_AUTHORIZE_PATH,
  IDP_CERTS_PATH,
  IDP_REVOKE_PATH,
  IDP_TOKEN_PATH,
  IDP_USERINFO_PATH,
} from '../../shared/paths';
import { type IdpCtx, issuerOf } from '../idp-context';

export function handleDiscovery(c: Context, ctx: IdpCtx): Response {
  const issuer = issuerOf(ctx, c);
  return c.json(
    {
      issuer,
      authorization_endpoint: `${issuer}${IDP_AUTHORIZE_PATH}`,
      token_endpoint: `${issuer}${IDP_TOKEN_PATH}`,
      userinfo_endpoint: `${issuer}${IDP_USERINFO_PATH}`,
      revocation_endpoint: `${issuer}${IDP_REVOKE_PATH}`,
      jwks_uri: `${issuer}${IDP_CERTS_PATH}`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: ['openid', 'email', 'profile'],
      token_endpoint_auth_methods_supported: [
        'client_secret_post',
        'client_secret_basic',
      ],
      claims_supported: [
        'aud',
        'email',
        'email_verified',
        'exp',
        'family_name',
        'given_name',
        'iat',
        'iss',
        'name',
        'picture',
        'sub',
      ],
      code_challenge_methods_supported: ['plain', 'S256'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
    },
    200
  );
}

export function handleCerts(c: Context, ctx: IdpCtx): Response {
  return c.json({ keys: [ctx.keys.publicJwk] }, 200);
}
