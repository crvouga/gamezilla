/**
 * Provider-neutral sign-in entry points. Adapters map each strategy to their
 * backend OAuth redirect.
 */
export type SignInStrategy = 'oauth-google';

/** Extra fields for strategies that need credentials (reserved for test harnesses). */
export type SignInCredentials = {
  readonly email?: string;
  readonly name?: string;
  readonly mode?: 'sign-in' | 'sign-up';
};
