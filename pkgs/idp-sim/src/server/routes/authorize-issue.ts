/** Mint the authorization code and build the response back to the relying party. */

import type {
  IdpConsentDetails,
  IdpScreenOutcome,
} from '../../shared/screen-state';
import type {
  IdpAccount,
  IdpAuthRequest,
  IdpEmailChoice,
} from '../../shared/types';
import {
  IDP_APPLE_AUTH_CODE_TTL_MS,
  IDP_AUTH_CODE_TTL_MS,
  type IdpStore,
} from '../idp-state';
import { appleUserBlob, disclosedEmail } from './apple-identity';
import { authorizeSuccessOutcome } from './authorize-response';
import { mintIdToken } from './token-mint';

/**
 * Codes are opaque and prefixed. The prefix is load-bearing only in that it
 * shows up in logs, but matching it keeps captured traffic readable.
 */
function mintCode(store: IdpStore): string {
  const raw = store.createId().replaceAll('-', '');
  return store.provider === 'apple'
    ? `c${raw}.0.mock.${raw.slice(0, 16)}`
    : `4/0A${raw}`;
}

function codeTtlMs(store: IdpStore): number {
  return store.provider === 'apple'
    ? IDP_APPLE_AUTH_CODE_TTL_MS
    : IDP_AUTH_CODE_TTL_MS;
}

export type IssueArgs = {
  readonly store: IdpStore;
  readonly issuer: string;
  readonly request: IdpAuthRequest;
  readonly account: IdpAccount;
  /** True when the human just approved the scopes on the consent screen. */
  readonly freshConsent: boolean;
  /** What Apple's first-authorization card collected, if it was shown. */
  readonly details: IdpConsentDetails | null;
};

function emailChoiceOf(args: IssueArgs, first: boolean): IdpEmailChoice | null {
  if (args.store.provider !== 'apple' || !first) return null;
  if (!args.request.scopes.includes('email')) return null;
  return args.details?.emailChoice ?? 'share';
}

/** Apple's `user` blob: first authorization, name/email scopes, once. */
async function firstUserBlob(
  args: IssueArgs,
  choice: IdpEmailChoice | null
): Promise<string | null> {
  const { store, account, request } = args;
  const email = await disclosedEmail({
    store,
    account,
    client: await store.client(request.clientId),
    clientId: request.clientId,
    choice,
  });
  return appleUserBlob({
    scopes: request.scopes,
    details: args.details ?? {
      givenName: account.givenName,
      familyName: account.familyName,
      emailChoice: choice ?? 'share',
    },
    email,
  });
}

/**
 * Records the grant, parks the code and builds the response. Call inside a
 * store transaction: the grant and the code must land together or a crash
 * leaves a code nobody can redeem against an approval that never happened.
 */
export async function issueAuthorization(
  args: IssueArgs
): Promise<IdpScreenOutcome> {
  const { store, request, account } = args;
  const first = (await store.grant(account.sub, request.clientId)) === null;
  const choice = emailChoiceOf(args, first);
  await store.recordGrant(
    account.sub,
    request.clientId,
    request.scopes,
    choice
  );
  const code = mintCode(store);
  const nowMs = store.clock.now();
  await store.putAuthCode({
    code,
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    sub: account.sub,
    scopes: request.scopes,
    nonce: request.nonce,
    codeChallenge: request.codeChallenge,
    codeChallengeMethod: request.codeChallengeMethod,
    issueRefreshToken:
      store.provider === 'apple' ||
      (request.accessType === 'offline' && args.freshConsent),
    expiresAtMs: nowMs + codeTtlMs(store),
    redeemed: false,
    firstAuthorization: first,
    authTimeMs: nowMs,
  });
  const isApple = store.provider === 'apple';
  const user = isApple && first ? await firstUserBlob(args, choice) : null;
  const idToken =
    request.responseType === 'code id_token'
      ? await mintIdToken(store, {
          issuer: args.issuer,
          account,
          clientId: request.clientId,
          scopes: request.scopes,
          nonce: request.nonce,
          accessToken: null,
          code,
          firstAuthorization: first,
          authTimeMs: nowMs,
        })
      : null;
  await store.deleteAuthRequest(request.id);
  return authorizeSuccessOutcome(store.provider, request, {
    code,
    idToken,
    user,
  });
}
