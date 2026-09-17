/** Minting the token triple (`access_token` / `refresh_token` / `id_token`). */

import type { IdpAccount } from '../../shared/types';
import { accessTokenHash, type IdpSigningKeys, signIdToken } from '../idp-keys';
import { IDP_ACCESS_TOKEN_TTL_MS, type IdpState } from '../idp-state';

export type MintedTokens = {
  readonly access_token: string;
  readonly expires_in: number;
  readonly scope: string;
  readonly token_type: 'Bearer';
  readonly id_token?: string;
  readonly refresh_token?: string;
};

function mintAccessToken(state: IdpState): string {
  return `ya29.${state.createId().replaceAll('-', '')}`;
}

function mintRefreshToken(state: IdpState): string {
  return `1//0${state.createId().replaceAll('-', '')}`;
}

async function buildIdToken(args: {
  readonly keys: IdpSigningKeys;
  readonly issuer: string;
  readonly account: IdpAccount;
  readonly grant: {
    readonly clientId: string;
    readonly nonce: string | null;
    readonly accessToken: string;
    readonly nowMs: number;
  };
}): Promise<string> {
  const { account, grant } = args;
  return await signIdToken({
    keys: args.keys,
    issuedAtMs: grant.nowMs,
    expiresAtMs: grant.nowMs + IDP_ACCESS_TOKEN_TTL_MS,
    claims: {
      iss: args.issuer,
      aud: grant.clientId,
      sub: account.sub,
      email: account.email,
      email_verified: account.emailVerified,
      name: account.name,
      given_name: account.givenName,
      family_name: account.familyName,
      picture: account.picture,
      at_hash: accessTokenHash(grant.accessToken),
      ...(account.hd === null ? {} : { hd: account.hd }),
      ...(grant.nonce === null ? {} : { nonce: grant.nonce }),
    },
  });
}

export async function mintTokens(args: {
  readonly ctx: { readonly state: IdpState; readonly keys: IdpSigningKeys };
  readonly issuer: string;
  readonly account: IdpAccount;
  readonly grant: {
    readonly clientId: string;
    readonly scopes: readonly string[];
    readonly nonce: string | null;
    readonly withRefreshToken: boolean;
  };
}): Promise<MintedTokens> {
  const { state, keys } = args.ctx;
  const { grant, account } = args;
  const nowMs = state.clock.now();
  const accessToken = mintAccessToken(state);
  state.accessTokens.set(accessToken, {
    token: accessToken,
    sub: account.sub,
    clientId: grant.clientId,
    scopes: grant.scopes,
    expiresAtMs: nowMs + IDP_ACCESS_TOKEN_TTL_MS,
  });
  const refreshToken =
    grant.withRefreshToken && !state.faults.withholdRefreshToken
      ? mintRefreshToken(state)
      : null;
  if (refreshToken !== null) {
    state.refreshTokens.set(refreshToken, {
      token: refreshToken,
      sub: account.sub,
      clientId: grant.clientId,
      scopes: grant.scopes,
      revoked: false,
    });
  }
  const idToken = grant.scopes.includes('openid')
    ? await buildIdToken({
        keys,
        issuer: args.issuer,
        account,
        grant: {
          clientId: grant.clientId,
          nonce: grant.nonce,
          accessToken,
          nowMs,
        },
      })
    : null;
  return {
    access_token: accessToken,
    expires_in: Math.floor(IDP_ACCESS_TOKEN_TTL_MS / 1000),
    scope: grant.scopes.join(' '),
    token_type: 'Bearer',
    ...(idToken === null ? {} : { id_token: idToken }),
    ...(refreshToken === null ? {} : { refresh_token: refreshToken }),
  };
}
