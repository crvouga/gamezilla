/** Minting the token triple (`access_token` / `refresh_token` / `id_token`). */

import type { IdpAccount, IdpFaults } from '../../shared/types';
import {
  accessTokenHash,
  type IdpSigningKeys,
  type IdTokenClaims,
  signIdToken,
} from '../idp-keys';
import {
  IDP_ACCESS_TOKEN_TTL_MS,
  IDP_APPLE_ACCESS_TOKEN_TTL_MS,
  type IdpStore,
} from '../idp-state';
import { disclosedEmail } from './apple-identity';

export type MintedTokens = {
  readonly access_token: string;
  readonly expires_in: number;
  /** Google echoes the granted scopes; Apple does not. */
  readonly scope?: string;
  readonly token_type: 'Bearer';
  readonly id_token?: string;
  readonly refresh_token?: string;
};

/** What one id_token is about, whichever endpoint mints it. */
export type IdTokenSubject = {
  readonly issuer: string;
  readonly account: IdpAccount;
  readonly clientId: string;
  readonly scopes: readonly string[];
  readonly nonce: string | null;
  /** `at_hash` source; `null` for an id_token minted at authorize. */
  readonly accessToken: string | null;
  /** `c_hash` source (Apple `code id_token`); `null` at the token endpoint. */
  readonly code: string | null;
  /** Apple sends `real_user_status` only for the first authorization. */
  readonly firstAuthorization: boolean;
  readonly authTimeMs: number;
};

function mintAccessToken(store: IdpStore): string {
  const raw = store.createId().replaceAll('-', '');
  return store.provider === 'apple'
    ? `a${raw}.0.mock.${raw.slice(0, 12)}`
    : `ya29.${raw}`;
}

function mintRefreshToken(store: IdpStore): string {
  const raw = store.createId().replaceAll('-', '');
  return store.provider === 'apple'
    ? `r${raw}.0.mock.${raw.slice(0, 12)}`
    : `1//0${raw}`;
}

/** Apple has sent booleans as `"true"` for years; the fault reproduces it. */
function flag(faults: IdpFaults, value: boolean): boolean | string {
  return faults.stringBooleanClaims ? String(value) : value;
}

function googleClaims(subject: IdTokenSubject, faults: IdpFaults) {
  const { account, scopes } = subject;
  return {
    azp: subject.clientId,
    ...(scopes.includes('email')
      ? {
          email: account.email,
          email_verified: flag(faults, account.emailVerified),
        }
      : {}),
    ...(scopes.includes('profile')
      ? {
          name: account.name,
          given_name: account.givenName,
          family_name: account.familyName,
          picture: account.picture,
        }
      : {}),
    ...(account.hd === null ? {} : { hd: account.hd }),
  };
}

async function appleClaims(
  store: IdpStore,
  subject: IdTokenSubject,
  faults: IdpFaults
): Promise<Record<string, unknown>> {
  const claims: Record<string, unknown> = {
    auth_time: Math.floor(subject.authTimeMs / 1000),
    nonce_supported: true,
  };
  if (subject.firstAuthorization) {
    claims['real_user_status'] = subject.account.realUserStatus;
  }
  const grant = await store.grant(subject.account.sub, subject.clientId);
  if (grant !== null && grant.scopes.includes('email')) {
    const disclosed = await disclosedEmail({
      store,
      account: subject.account,
      client: await store.client(subject.clientId),
      clientId: subject.clientId,
      choice: grant.emailChoice,
    });
    claims['email'] = disclosed.email;
    claims['email_verified'] = flag(faults, true);
    if (disclosed.isPrivate) claims['is_private_email'] = flag(faults, true);
  }
  return claims;
}

async function signingKeysFor(
  store: IdpStore,
  faults: IdpFaults
): Promise<IdpSigningKeys> {
  return faults.idTokenSignedWithUnknownKey
    ? await store.unpublishedSigningKeys()
    : store.keys;
}

export async function mintIdToken(
  store: IdpStore,
  subject: IdTokenSubject
): Promise<string> {
  const faults = await store.faults();
  const nowMs = store.clock.now() + faults.idTokenClockSkewSeconds * 1000;
  const specific =
    store.provider === 'apple'
      ? await appleClaims(store, subject, faults)
      : googleClaims(subject, faults);
  const claims: IdTokenClaims = {
    iss: subject.issuer,
    aud: subject.clientId,
    sub: subject.account.sub,
    ...specific,
    ...(subject.accessToken === null
      ? {}
      : { at_hash: accessTokenHash(subject.accessToken) }),
    ...(subject.code === null ? {} : { c_hash: accessTokenHash(subject.code) }),
    ...(subject.nonce === null ? {} : { nonce: subject.nonce }),
  };
  return await signIdToken({
    keys: await signingKeysFor(store, faults),
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + IDP_ACCESS_TOKEN_TTL_MS,
    claims,
  });
}

function accessTtlMs(store: IdpStore): number {
  return store.provider === 'apple'
    ? IDP_APPLE_ACCESS_TOKEN_TTL_MS
    : IDP_ACCESS_TOKEN_TTL_MS;
}

/** Apple mints an id_token on every grant; Google only for `openid`. */
function wantsIdToken(store: IdpStore, scopes: readonly string[]): boolean {
  return store.provider === 'apple' || scopes.includes('openid');
}

async function issueRefreshToken(
  store: IdpStore,
  subject: IdTokenSubject
): Promise<string> {
  const token = mintRefreshToken(store);
  await store.putRefreshToken({
    token,
    sub: subject.account.sub,
    clientId: subject.clientId,
    scopes: subject.scopes,
    revoked: false,
  });
  return token;
}

export async function mintTokens(args: {
  readonly store: IdpStore;
  readonly subject: Omit<IdTokenSubject, 'accessToken' | 'code'>;
  readonly withRefreshToken: boolean;
}): Promise<MintedTokens> {
  const { store } = args;
  const nowMs = store.clock.now();
  const accessToken = mintAccessToken(store);
  const ttlMs = accessTtlMs(store);
  const subject: IdTokenSubject = { ...args.subject, accessToken, code: null };
  await store.putAccessToken({
    token: accessToken,
    sub: subject.account.sub,
    clientId: subject.clientId,
    scopes: subject.scopes,
    expiresAtMs: nowMs + ttlMs,
  });
  const faults = await store.faults();
  const refreshToken =
    args.withRefreshToken && !faults.withholdRefreshToken
      ? await issueRefreshToken(store, subject)
      : null;
  const idToken = wantsIdToken(store, subject.scopes)
    ? await mintIdToken(store, subject)
    : null;
  return {
    access_token: accessToken,
    expires_in: Math.floor(ttlMs / 1000),
    ...(store.provider === 'google' ? { scope: subject.scopes.join(' ') } : {}),
    token_type: 'Bearer',
    ...(idToken === null ? {} : { id_token: idToken }),
    ...(refreshToken === null ? {} : { refresh_token: refreshToken }),
  };
}
