/**
 * Provider-neutral sign-in entry points. Adapters map each strategy to their
 * backend (OAuth redirect, email/password, etc.).
 */
export type SignInStrategy = 'oauth-google' | 'email-password';

/** Extra fields for strategies that need credentials (email/password). */
export type SignInCredentials = {
  readonly email: string;
  readonly password: string;
  /** `sign-in` (default) or `sign-up` for email/password. */
  readonly mode?: 'sign-in' | 'sign-up';
};
