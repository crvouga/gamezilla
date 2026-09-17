/** Mint the authorization code and bounce back to the relying party. */

import type { IdpAccount, IdpAuthRequest } from '../../shared/types';
import { IDP_AUTH_CODE_TTL_MS, type IdpState, recordGrant } from '../idp-state';

/**
 * Google's codes are opaque and prefixed; the prefix is load-bearing only in
 * that it shows up in logs, but matching it keeps captured traffic readable.
 */
function mintCode(state: IdpState): string {
  return `4/0A${state.createId().replaceAll('-', '')}`;
}

export function issueAuthorizationCode(args: {
  readonly state: IdpState;
  readonly request: IdpAuthRequest;
  readonly account: IdpAccount;
  /** True when the human just approved the scopes on the consent screen. */
  readonly freshConsent: boolean;
}): string {
  const { state, request, account } = args;
  recordGrant(state, account.sub, request.clientId, request.scopes);
  const code = mintCode(state);
  state.authCodes.set(code, {
    code,
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    sub: account.sub,
    scopes: request.scopes,
    nonce: request.nonce,
    codeChallenge: request.codeChallenge,
    codeChallengeMethod: request.codeChallengeMethod,
    issueRefreshToken: request.accessType === 'offline' && args.freshConsent,
    expiresAtMs: state.clock.now() + IDP_AUTH_CODE_TTL_MS,
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
