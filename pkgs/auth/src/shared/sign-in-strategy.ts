/**
 * Provider-neutral sign-in entry points. Adapters map each strategy to their
 * backend (OAuth redirect, fake Dev social, etc.).
 */
export type SignInStrategy = 'oauth-google' | 'oauth-dev';

/** Extra fields for strategies that need credentials (Dev social subject). */
export type SignInCredentials = {
  /** Dev provider stable subject (maps 1:1 to an IdP user). */
  readonly subject?: string;
  readonly email?: string;
  readonly name?: string;
  readonly mode?: 'sign-in' | 'sign-up';
};
