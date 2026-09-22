/**
 * The environment the model reasons about: what each provider will say about
 * an account, and whether a round trip can succeed at all given the faults
 * switched on. Read from the provider nodes directly — they are the world,
 * not the system under test.
 */

import {
  AUTH_ERROR,
  type AuthErrorCode,
  type OauthProviderId,
} from '@pkgs/auth/shared';
import type { IdpEmailChoice, IdpFaults } from '@pkgs/idp-sim/shared';

import { APPLE_CLIENT_ID, APPLE_TEAM_ID, GOOGLE_CLIENT_ID } from './idp-node';
import type { SeenIdentity } from './model';
import type { AuthStore, ProviderAnswers } from './types';

/** Allowed id_token skew at the relying party (see its JWKS verifier). */
const TOLERANCE_S = 60;
/** The relying party refuses an id_token issued further ahead than this. */
const MAX_FUTURE_IAT_S = 300;
/** Mock id_tokens live this long. */
const ID_TOKEN_LIFETIME_S = 3599;

const GOOGLE_SCOPES = ['openid', 'email', 'profile'] as const;

export function clientIdOf(provider: OauthProviderId): string {
  return provider === 'apple' ? APPLE_CLIENT_ID : GOOGLE_CLIENT_ID;
}

/**
 * What the relying party will learn if `email` signs in at `provider`, or
 * `null` when no such account exists there. Apple's address choice is made
 * once per grant: an existing grant's choice wins over today's answer.
 */
export async function seenIdentity(
  store: AuthStore,
  provider: OauthProviderId,
  answers: Pick<ProviderAnswers, 'email' | 'emailChoice'>
): Promise<SeenIdentity | null> {
  const idp = store.idps[provider].ctx.store;
  const account = await idp.accountByEmail(answers.email);
  if (account === null) return null;
  if (provider === 'google') {
    return {
      provider,
      sub: account.sub,
      email: account.email,
      verified: account.emailVerified,
      isPrivate: false,
    };
  }
  const grant = await idp.grant(account.sub, APPLE_CLIENT_ID);
  const choice: IdpEmailChoice = grant?.emailChoice ?? answers.emailChoice;
  const email =
    choice === 'hide'
      ? (await idp.relayAddress(account.sub, APPLE_TEAM_ID)).email
      : account.email;
  return {
    provider,
    sub: account.sub,
    email,
    verified: true,
    isPrivate: choice === 'hide',
  };
}

/** Whether the consent card will be shown (and so a "deny" answer bites). */
async function consentShown(
  store: AuthStore,
  provider: OauthProviderId,
  sub: string
): Promise<boolean> {
  if (provider === 'apple') return true;
  const idp = store.idps.google.ctx.store;
  return !(await idp.hasGrant(sub, GOOGLE_CLIENT_ID, GOOGLE_SCOPES));
}

function exchangeFails(provider: OauthProviderId, faults: IdpFaults): boolean {
  if (faults.tokenEndpoint !== 'ok') return true;
  if (provider === 'google') return faults.userinfoEndpoint !== 'ok';
  // Apple is verified by id_token: the key and the clock matter.
  const skew = faults.idTokenClockSkewSeconds;
  return (
    faults.idTokenSignedWithUnknownKey ||
    skew > MAX_FUTURE_IAT_S ||
    skew + ID_TOKEN_LIFETIME_S <= -TOLERANCE_S
  );
}

/**
 * `null` when the provider leg of a round trip will succeed; otherwise the
 * error the app ends up with (`cancelled` covers the person backing out,
 * an unknown address, and a provider that refuses on their behalf).
 */
export async function providerVerdict(
  store: AuthStore,
  provider: OauthProviderId,
  answers: ProviderAnswers,
  seen: SeenIdentity | null
): Promise<AuthErrorCode | null> {
  if (seen === null) return AUTH_ERROR.cancelled;
  const faults = await store.idps[provider].ctx.store.faults();
  if (faults.denyConsent) return AUTH_ERROR.cancelled;
  if (
    answers.consent === 'deny' &&
    (await consentShown(store, provider, seen.sub))
  ) {
    return AUTH_ERROR.cancelled;
  }
  return exchangeFails(provider, faults) ? AUTH_ERROR.providerFailed : null;
}
