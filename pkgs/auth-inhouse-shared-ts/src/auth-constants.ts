import type { OauthProviderId } from '@pkgs/auth-root-shared-ts/sign-in-method';

export const AUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const AUTH_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
/** A link ticket authorizes one link launch within this window. */
export const AUTH_LINK_TICKET_TTL_MS = 10 * 60 * 1000;
/** A pending link waits this long for the person to prove the other account. */
export const AUTH_PENDING_LINK_TTL_MS = 10 * 60 * 1000;
/** An emailed sign-in link works once, within this window. */
export const AUTH_EMAIL_LINK_TTL_MS = 10 * 60 * 1000;
/** An address may ask for this many links per {@link AUTH_EMAIL_LINK_WINDOW_MS}. */
export const AUTH_EMAIL_LINK_REQUEST_LIMIT = 10;
export const AUTH_EMAIL_LINK_WINDOW_MS = 10 * 60 * 1000;
export const AUTH_SET_TOKEN_HEADER = 'set-auth-token';

export const IDP_PROVIDER_GOOGLE = 'google' satisfies OauthProviderId;
export const IDP_PROVIDER_APPLE = 'apple' satisfies OauthProviderId;

/**
 * Where the Google OAuth conversation happens. These are configuration, not
 * constants: pointing them at a simulated provider on loopback is what lets
 * the production exchange path run end to end without leaving the machine.
 */
export type GoogleOauthEndpoints = {
  readonly authorizeUrl: string;
  readonly tokenUrl: string;
  readonly userinfoUrl: string;
  readonly revokeUrl: string;
};

export const GOOGLE_PRODUCTION_ENDPOINTS: GoogleOauthEndpoints = {
  authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userinfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
  revokeUrl: 'https://oauth2.googleapis.com/revoke',
};

/** Sign in with Apple's surface. There is no userinfo: identity is the id_token. */
export type AppleOauthEndpoints = {
  readonly authorizeUrl: string;
  readonly tokenUrl: string;
  readonly jwksUrl: string;
  readonly revokeUrl: string;
};

/**
 * The `aud` of the client-secret JWT. Apple checks this literal whatever
 * origin its endpoints are served from, so a mock does too.
 */
export const APPLE_CLIENT_SECRET_AUDIENCE = 'https://appleid.apple.com';

/** Query keys the callback redirect carries back to the app. */
export const AUTH_CALLBACK_PARAM = {
  code: 'code',
  error: 'error',
  /** An address match needs confirming: the pending link's token. */
  linkRequired: 'link_required',
  /** Providers that can prove the existing account (comma-separated). */
  linkProviders: 'link_providers',
  /** The existing account's address, masked (`a•••@gmail.com`). */
  linkEmail: 'link_email',
  /** The sign-in method whose identity is waiting to be linked. */
  linkProvider: 'link_provider',
  /** An emailed sign-in link's one-time token (`POST /auth/email/confirm`). */
  emailLink: 'email_link',
} as const;
