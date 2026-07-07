/**
 * Provider-neutral sign-in entry points. Adapters map each strategy to their
 * backend (OAuth redirect, etc.).
 */
export type SignInStrategy = 'oauth-google' | 'oauth-apple';
