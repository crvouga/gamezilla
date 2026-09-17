export const AUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const AUTH_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const AUTH_SET_TOKEN_HEADER = 'set-auth-token';

/**
 * Where the Google OAuth conversation happens. These are configuration, not
 * constants: pointing them at a simulated provider on loopback is what lets
 * the production exchange path run end to end without leaving the machine.
 */
export type GoogleOauthEndpoints = {
  readonly authorizeUrl: string;
  readonly tokenUrl: string;
  readonly userinfoUrl: string;
};

export const GOOGLE_PRODUCTION_ENDPOINTS: GoogleOauthEndpoints = {
  authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userinfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
};

export const IDP_PROVIDER_GOOGLE = 'google';
