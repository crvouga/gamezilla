/** Discovery documents + JWKS, shaped like each provider's. */

import type { Context } from 'hono';

import {
  APPLE_AUTHORIZE_PATH,
  APPLE_KEYS_PATH,
  APPLE_REVOKE_PATH,
  APPLE_TOKEN_PATH,
  IDP_AUTHORIZE_PATH,
  IDP_CERTS_PATH,
  IDP_REVOKE_PATH,
  IDP_TOKEN_PATH,
  IDP_USERINFO_PATH,
} from '../../shared/paths';
import { type IdpCtx, issuerOf } from '../idp-context';

/** Apple's document: `pairwise` subjects, three response modes, no userinfo. */
function appleDiscovery(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}${APPLE_AUTHORIZE_PATH}`,
    token_endpoint: `${issuer}${APPLE_TOKEN_PATH}`,
    revocation_endpoint: `${issuer}${APPLE_REVOKE_PATH}`,
    jwks_uri: `${issuer}${APPLE_KEYS_PATH}`,
    response_types_supported: ['code'],
    response_modes_supported: ['query', 'fragment', 'form_post'],
    subject_types_supported: ['pairwise'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'email', 'name'],
    token_endpoint_auth_methods_supported: ['client_secret_post'],
    claims_supported: [
      'aud',
      'email',
      'email_verified',
      'exp',
      'iat',
      'is_private_email',
      'iss',
      'nonce',
      'nonce_supported',
      'real_user_status',
      'sub',
      'transfer_sub',
    ],
  };
}

export function handleDiscovery(c: Context, ctx: IdpCtx): Response {
  const issuer = issuerOf(ctx, c);
  if (ctx.store.provider === 'apple') {
    return c.json(appleDiscovery(issuer), 200);
  }
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
  return c.json({ keys: ctx.store.publishedJwks() }, 200);
}
