/** Wire + state shapes for the simulated Google IdP. */

export type IdpAccount = {
  /** Stable Google `sub`: an opaque 21-digit-ish numeric string. */
  readonly sub: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly name: string;
  readonly givenName: string;
  readonly familyName: string;
  readonly picture: string;
  /** Workspace domain (`hd` claim); `null` for consumer accounts. */
  readonly hd: string | null;
};

/**
 * Input for a directory entry. `handle` alone is enough (`alice` →
 * `alice@gmail.com`); a create-account submission supplies `email` and `name`.
 */
export type IdpAccountDraft = {
  /** Local part of the address and the display-name source, e.g. `alice`. */
  readonly handle?: string;
  readonly sub?: string;
  readonly email?: string;
  readonly name?: string;
  readonly givenName?: string;
  readonly familyName?: string;
  readonly picture?: string;
  readonly hd?: string | null;
  readonly emailVerified?: boolean;
};

/**
 * Every account in the simulated directory authenticates with this one
 * literal. It is deliberately not a secret and deliberately not per-account:
 * local work needs a password that is obvious and never expires.
 */
export const IDP_PASSWORD = 'password';

export type IdpClient = {
  readonly clientId: string;
  readonly clientSecret: string;
  /** Exact-match list, like the Google Cloud console "Authorized redirect URIs". */
  readonly redirectUris: readonly string[];
  /** Shown on the consent screen. */
  readonly appName: string;
};

/**
 * Deliberate misbehaviour switches. Every relying party has to survive these,
 * and they are the part of Google that is impossible to provoke on demand.
 */
export type IdpFaults = {
  /** `/token` answers 500 instead of minting a grant. */
  readonly tokenEndpoint: 'ok' | 'server_error' | 'invalid_client';
  /** `/v1/userinfo` answers 500 / 401 instead of the profile. */
  readonly userinfoEndpoint: 'ok' | 'server_error' | 'unauthorized';
  /** Authorize bounces straight back with `error=access_denied`. */
  readonly denyConsent: boolean;
  /** Token responses omit `refresh_token` even for offline access. */
  readonly withholdRefreshToken: boolean;
};

export const IDP_DEFAULT_FAULTS: IdpFaults = {
  tokenEndpoint: 'ok',
  userinfoEndpoint: 'ok',
  denyConsent: false,
  withholdRefreshToken: false,
};

export type IdpPrompt = 'none' | 'consent' | 'select_account' | 'login';

/** One in-flight `/o/oauth2/v2/auth` request, parked while the human decides. */
export type IdpAuthRequest = {
  readonly id: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scopes: readonly string[];
  readonly state: string | null;
  readonly nonce: string | null;
  readonly codeChallenge: string | null;
  readonly codeChallengeMethod: 'S256' | 'plain' | null;
  readonly accessType: 'online' | 'offline';
  readonly prompts: readonly IdpPrompt[];
  readonly loginHint: string | null;
  readonly createdAtMs: number;
  /** Account the human picked, carried across the consent post back. */
  readonly chosenSub: string | null;
  /**
   * Address parked after step 1 of sign-in, before the password is checked.
   * `null` means the human has not typed an address yet.
   */
  readonly identifierEmail: string | null;
};

export type IdpAuthCode = {
  readonly code: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly sub: string;
  readonly scopes: readonly string[];
  readonly nonce: string | null;
  readonly codeChallenge: string | null;
  readonly codeChallengeMethod: 'S256' | 'plain' | null;
  readonly issueRefreshToken: boolean;
  readonly expiresAtMs: number;
  /** Google invalidates the whole grant when a code is replayed. */
  redeemed: boolean;
};

export type IdpAccessToken = {
  readonly token: string;
  readonly sub: string;
  readonly clientId: string;
  readonly scopes: readonly string[];
  readonly expiresAtMs: number;
};

export type IdpRefreshToken = {
  readonly token: string;
  readonly sub: string;
  readonly clientId: string;
  readonly scopes: readonly string[];
  revoked: boolean;
};

/** What the browser cookie remembers: Google keeps several accounts signed in. */
export type IdpBrowserSession = {
  readonly id: string;
  /** Signed-in subjects, most recently authenticated last. */
  readonly signedIn: string[];
};

export type IdpTokenErrorBody = {
  readonly error: string;
  readonly error_description: string;
};
