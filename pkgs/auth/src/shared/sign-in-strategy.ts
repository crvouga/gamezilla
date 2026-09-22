import type { OauthProviderId } from './auth-constants';

/**
 * Provider-neutral sign-in entry points. Adapters map each strategy to their
 * backend OAuth redirect.
 */
export type SignInStrategy = 'oauth-google' | 'oauth-apple';

export function strategyForProvider(provider: OauthProviderId): SignInStrategy {
  return provider === 'apple' ? 'oauth-apple' : 'oauth-google';
}

export function providerOfStrategy(strategy: SignInStrategy): OauthProviderId {
  return strategy === 'oauth-apple' ? 'apple' : 'google';
}

export type SignInOptions = {
  /**
   * Finish a pending link: this sign-in proves the account an earlier
   * sign-in's address matched, and the parked identity joins it.
   */
  readonly pendingLink?: string;
};
