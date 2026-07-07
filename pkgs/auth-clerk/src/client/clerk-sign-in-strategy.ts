import type { SignInStrategy } from '@pkgs/auth/shared/sign-in-strategy';

type ClerkOAuthStrategy = 'oauth_google' | 'oauth_apple';

const STRATEGY_MAP: Record<SignInStrategy, ClerkOAuthStrategy> = {
  'oauth-google': 'oauth_google',
  'oauth-apple': 'oauth_apple',
};

export function mapSignInStrategyToClerk(
  strategy: SignInStrategy
): ClerkOAuthStrategy {
  return STRATEGY_MAP[strategy];
}
