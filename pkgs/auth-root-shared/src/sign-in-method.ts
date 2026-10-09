/**
 * The social sign-in methods the product offers. This is the product's
 * vocabulary, not any auth service's: every adapter maps its own connection,
 * strategy or provider ids onto these, and the UI renders exactly these.
 */
export const OAUTH_PROVIDER_IDS = ['google', 'apple'] as const;

export type OauthProviderId = (typeof OAUTH_PROVIDER_IDS)[number];

export type SignInMethodId = OauthProviderId | 'password';

export function isSignInMethodId(raw: string): raw is SignInMethodId {
  return raw === 'password' || isOauthProviderId(raw);
}

export function isOauthProviderId(raw: string): raw is OauthProviderId {
  return (OAUTH_PROVIDER_IDS as readonly string[]).includes(raw);
}
