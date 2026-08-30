export const AUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const AUTH_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const AUTH_SET_TOKEN_HEADER = 'set-auth-token';

export const GOOGLE_OAUTH_AUTHORIZE_URL =
  'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_OAUTH_USERINFO_URL =
  'https://openidconnect.googleapis.com/v1/userinfo';

export const IDP_PROVIDER_GOOGLE = 'google';
export const IDP_PROVIDER_DEV = 'dev';
