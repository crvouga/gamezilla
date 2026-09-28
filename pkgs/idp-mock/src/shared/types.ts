/** Wire + state shapes for the simulated identity providers. */

/**
 * Which real provider's wire this instance speaks. One process serves one
 * flavor on one origin with its own directory — a Google account and an Apple
 * account are different identities even when they share an address, exactly
 * as they are in production.
 */
export type IdpProviderKind = 'google' | 'apple';

export const IDP_PROVIDER_KINDS: readonly IdpProviderKind[] = [
  'google',
  'apple',
];

/**
 * Apple's `real_user_status`: `0` unsupported, `1` unknown, `2` likely real.
 * Google has no such claim; its accounts carry `1` and never emit it.
 */
export type IdpRealUserStatus = 0 | 1 | 2;

export type IdpAccount = {
  /**
   * Stable subject. Google: a 21-digit decimal string. Apple: the
   * `000123.<32 hex>.4567` team-scoped shape.
   */
  readonly sub: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly name: string;
  readonly givenName: string;
  readonly familyName: string;
  /** Profile photo URL; Apple never shares one, so it is `''` there. */
  readonly picture: string;
  /** Workspace domain (`hd` claim); `null` for consumer accounts. */
  readonly hd: string | null;
  readonly realUserStatus: IdpRealUserStatus;
};

/**
 * Input for a directory entry. `handle` alone is enough (`alice` →
 * `alice@gmail.com` / `alice@icloud.com`); a create-account submission
 * supplies `email` and `name`.
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
  readonly realUserStatus?: IdpRealUserStatus;
};

/**
 * Every account in the simulated directory authenticates with this one
 * literal. It is deliberately not a secret and deliberately not per-account:
 * local work needs a password that is obvious and never expires.
 */
export const IDP_PASSWORD = 'password';

/**
 * What an Apple Services ID registration carries beyond Google's client:
 * the developer team, the key the relying party signs its `client_secret`
 * JWT with (public half only — the private key never leaves the relying
 * party), and where server-to-server notifications go.
 */
export type IdpAppleClient = {
  readonly teamId: string;
  readonly keyId: string;
  /** Public ES256 JWK of the relying party's Sign in with Apple key. */
  readonly publicJwk: Readonly<Record<string, unknown>>;
  /** Server-to-server notification endpoint, or `null` when unregistered. */
  readonly notificationUrl: string | null;
};

export type IdpClient = {
  readonly clientId: string;
  /** Google's shared secret. Apple clients authenticate with a JWT instead. */
  readonly clientSecret: string;
  /** Exact-match list, like the console's "Authorized redirect URIs". */
  readonly redirectUris: readonly string[];
  /** Shown on the consent screen. */
  readonly appName: string;
  /** Present only on an Apple-flavored provider. */
  readonly apple?: IdpAppleClient | undefined;
};

/**
 * Deliberate misbehaviour switches. Every relying party has to survive these,
 * and they are the part of a provider that is impossible to provoke on demand.
 */
export type IdpFaults = {
  /** The token endpoint answers 500 / `invalid_client` instead of a grant. */
  readonly tokenEndpoint: 'ok' | 'server_error' | 'invalid_client';
  /** `/v1/userinfo` answers 500 / 401 instead of the profile (Google). */
  readonly userinfoEndpoint: 'ok' | 'server_error' | 'unauthorized';
  /** Authorize bounces straight back with the provider's "denied" error. */
  readonly denyConsent: boolean;
  /** Token responses omit `refresh_token` even when one is due. */
  readonly withholdRefreshToken: boolean;
  /**
   * Boolean id_token claims (`email_verified`, `is_private_email`) arrive as
   * the strings `"true"` / `"false"`, as Apple has sent them for years.
   */
  readonly stringBooleanClaims: boolean;
  /**
   * `iat` / `exp` shifted by this many seconds: a provider whose clock runs
   * ahead (positive) or an `id_token` that is already stale (negative).
   */
  readonly idTokenClockSkewSeconds: number;
  /** The id_token is signed with a key the JWKS does not publish. */
  readonly idTokenSignedWithUnknownKey: boolean;
};

export const IDP_DEFAULT_FAULTS: IdpFaults = {
  tokenEndpoint: 'ok',
  userinfoEndpoint: 'ok',
  denyConsent: false,
  withholdRefreshToken: false,
  stringBooleanClaims: false,
  idTokenClockSkewSeconds: 0,
  idTokenSignedWithUnknownKey: false,
};

export type IdpPrompt = 'none' | 'consent' | 'select_account' | 'login';

/** How the authorization response travels back (Apple offers all three). */
export type IdpResponseMode = 'query' | 'fragment' | 'form_post';

/** Apple's "Share My Email" / "Hide My Email" decision. */
export type IdpEmailChoice = 'share' | 'hide';

/** One in-flight authorize request, parked while the human decides. */
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
  /** `code` everywhere; Apple also accepts `code id_token`. */
  readonly responseType: 'code' | 'code id_token';
  readonly responseMode: IdpResponseMode;
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
  /** Apple: this code finished the app's first authorization. */
  readonly firstAuthorization: boolean;
  readonly authTimeMs: number;
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

/** One app's standing authorization for one account. */
export type IdpGrant = {
  readonly sub: string;
  readonly clientId: string;
  readonly scopes: readonly string[];
  /** Apple only: what the human chose for their address; `null` on Google. */
  readonly emailChoice: IdpEmailChoice | null;
};

/**
 * An Apple private relay address. It is stable per account per developer
 * team, and forwarding can be switched off by the account holder.
 */
export type IdpRelayAddress = {
  readonly sub: string;
  readonly teamId: string;
  readonly email: string;
  readonly forwarding: boolean;
};

/** What the browser cookie remembers: several accounts can be signed in. */
export type IdpBrowserSession = {
  readonly id: string;
  /** Signed-in subjects, most recently authenticated last. */
  readonly signedIn: string[];
};

export type IdpTokenErrorBody = {
  readonly error: string;
  readonly error_description?: string;
};

/** Apple's server-to-server notification event types. */
export type IdpAppleEventType =
  | 'consent-revoked'
  | 'account-delete'
  | 'email-disabled'
  | 'email-enabled';

export const IDP_APPLE_EVENT_TYPES: readonly IdpAppleEventType[] = [
  'consent-revoked',
  'account-delete',
  'email-disabled',
  'email-enabled',
];
