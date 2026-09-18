/** Mint the authorization code and bounce back to the relying party. */

import type { IdpAccount, IdpAuthRequest } from '../../shared/types';
import { IDP_AUTH_CODE_TTL_MS, type IdpStore } from '../idp-state';

/**
 * Google's codes are opaque and prefixed; the prefix is load-bearing only in
 * that it shows up in logs, but matching it keeps captured traffic readable.
 */
function mintCode(store: IdpStore): string {
  return `4/0A${store.createId().replaceAll('-', '')}`;
}

/**
 * Records the grant and parks the code. Call inside a store transaction: the
 * grant and the code must land together or a crash leaves a code nobody can
 * redeem against an approval that never happened.
 */
export async function issueAuthorizationCode(args: {
  readonly store: IdpStore;
  readonly request: IdpAuthRequest;
  readonly account: IdpAccount;
  /** True when the human just approved the scopes on the consent screen. */
  readonly freshConsent: boolean;
}): Promise<string> {
  const { store, request, account } = args;
  await store.recordGrant(account.sub, request.clientId, request.scopes);
  const code = mintCode(store);
  await store.putAuthCode({
    code,
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    sub: account.sub,
    scopes: request.scopes,
    nonce: request.nonce,
    codeChallenge: request.codeChallenge,
    codeChallengeMethod: request.codeChallengeMethod,
    issueRefreshToken: request.accessType === 'offline' && args.freshConsent,
    expiresAtMs: store.clock.now() + IDP_AUTH_CODE_TTL_MS,
    redeemed: false,
  });
  return code;
}

export function authorizeSuccessRedirect(args: {
  readonly request: IdpAuthRequest;
  readonly code: string;
}): string {
  const url = new URL(args.request.redirectUri);
  url.searchParams.set('code', args.code);
  if (args.request.state !== null) {
    url.searchParams.set('state', args.request.state);
  }
  url.searchParams.set('scope', args.request.scopes.join(' '));
  url.searchParams.set('authuser', '0');
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}
