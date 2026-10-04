/**
 * The environment the model reasons about: what each provider will say about
 * an account, and whether a round trip can succeed at all given the faults
 * switched on. Read from the provider nodes directly — their directories and
 * their grants (what each has granted the example app) — because they are
 * the world, not the system under test.
 */

import type { AuthErrorCode } from '@pkgs/auth-shared/auth-error-code';
import { AUTH_ERROR } from '@pkgs/auth-shared/auth-error-code';
import type { OauthProviderId } from '@pkgs/auth-shared/sign-in-method';
import type { SeenIdentity } from './model';
import type { AuthIdp, ProviderFaults } from './providers';
import { accountAt } from './providers';
import { APPLE_CLIENT_ID, GOOGLE_CLIENT_ID } from './relying-party';
import type { AuthStore, ProviderAnswers } from './types';

/** Allowed id_token skew at the relying party (see its JWKS verifier). */
const TOLERANCE_S = 60;
/** The relying party refuses an id_token issued further ahead than this. */
const MAX_FUTURE_IAT_S = 300;
/** The providers' id_tokens live this long. */
const ID_TOKEN_LIFETIME_S = 3600;

export function clientIdOf(provider: OauthProviderId): string {
  return provider === 'apple' ? APPLE_CLIENT_ID : GOOGLE_CLIENT_ID;
}

/** What the provider has granted the example app for `accountId`. */
export type ProviderGrant = {
  readonly subject: string;
  readonly granted: boolean;
  readonly emailChoice: 'share' | 'hide' | null;
};

/**
 * The provider's own account of the grant: the subject the app is (or would
 * be) issued, whether it holds a consent, and Apple's address choice.
 */
export async function grantOf(
  idp: AuthIdp,
  provider: OauthProviderId,
  accountId: string
): Promise<ProviderGrant> {
  const grant = await idp.runtime
    .instance()
    .grant(clientIdOf(provider), accountId);
  if (grant === null) throw new Error(`${provider} has no ${accountId}`);
  return grant;
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
  const idp = store.idps[provider];
  const account = accountAt(idp, answers.email);
  if (account === null) return null;
  const grant = await grantOf(idp, provider, account.id);
  if (provider === 'google') {
    return {
      provider,
      sub: grant.subject,
      email: account.email,
      verified: account.emailVerified ?? true,
      isPrivate: false,
    };
  }
  const hide = (grant.emailChoice ?? answers.emailChoice) === 'hide';
  return {
    provider,
    sub: grant.subject,
    email: hide ? (account.relayEmail ?? null) : account.email,
    verified: true,
    isPrivate: hide,
  };
}

/**
 * Whether the consent card will be shown (and so a "deny" answer bites):
 * Apple asks every time; Google only until the app holds a grant.
 */
async function consentShown(
  store: AuthStore,
  provider: OauthProviderId,
  email: string
): Promise<boolean> {
  if (provider === 'apple') return true;
  const idp = store.idps.google;
  const account = accountAt(idp, email);
  if (account === null) return true;
  return !(await grantOf(idp, provider, account.id)).granted;
}

function exchangeFails(
  provider: OauthProviderId,
  faults: ProviderFaults
): boolean {
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
  const faults = store.idps[provider].faults();
  if (faults.denyConsent) return AUTH_ERROR.cancelled;
  if (
    answers.consent === 'deny' &&
    (await consentShown(store, provider, answers.email))
  ) {
    return AUTH_ERROR.cancelled;
  }
  return exchangeFails(provider, faults) ? AUTH_ERROR.providerFailed : null;
}
