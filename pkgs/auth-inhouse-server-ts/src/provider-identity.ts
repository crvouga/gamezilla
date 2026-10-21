/**
 * What every sign-in hands the auth app: one authenticated identity,
 * normalized. Providers disagree on shapes (Google's userinfo booleans,
 * Apple's `"true"` strings, Apple's name that arrives exactly once in a form
 * field), and an opened email link has only its address; this is the one
 * shape linking and sign-in reason about.
 */

import type {
  OauthProviderId,
  SignInMethodId,
} from '@pkgs/auth-root-shared-ts/sign-in-method';

export type ProviderIdentity = {
  readonly provider: SignInMethodId;
  readonly providerUserId: string;
  readonly email: string | null;
  /** The provider vouches that the person controls `email`. */
  readonly emailVerified: boolean;
  /** Apple Hide My Email relay: a real, verified, but *private* address. */
  readonly isPrivateEmail: boolean;
  /** `null` when the provider did not send one this time (Apple after #1). */
  readonly name: string | null;
  readonly picture: string | null;
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
};

/** Everything a callback can carry, however it arrived (query or form post). */
export type ProviderCallback = {
  readonly code: string;
  /** Apple `form_post`: the first-authorization `user` JSON, else `null`. */
  readonly user: string | null;
};

export type ProviderAuthorizeArgs = {
  readonly redirectUri: string;
  readonly state: string;
  readonly codeVerifier: string;
  readonly nonce: string;
};

export type ProviderExchangeArgs = {
  readonly redirectUri: string;
  readonly callback: ProviderCallback;
  readonly codeVerifier: string;
  readonly nonce: string;
};

/**
 * One provider, behind the four things the auth app needs from it. Adapters
 * carry their own egress and clock; nothing here touches the database.
 */
export type OauthProviderAdapter = {
  readonly id: OauthProviderId;
  /** How the provider returns: Google redirects, Apple POSTs a form. */
  readonly callbackMethod: 'GET' | 'POST';
  authorizationUrl(args: ProviderAuthorizeArgs): Promise<string>;
  exchange(args: ProviderExchangeArgs): Promise<ProviderIdentity>;
  /** Tell the provider the app no longer holds this grant (best effort). */
  revoke(refreshToken: string): Promise<boolean>;
};

/**
 * A boolean claim as providers actually send it: `true`, or the string
 * `"true"` (Apple, for years). Anything else — including a missing claim —
 * is false, because "unverified" is the safe reading.
 */
export function claimFlag(value: unknown): boolean {
  return value === true || value === 'true';
}

export function claimString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
