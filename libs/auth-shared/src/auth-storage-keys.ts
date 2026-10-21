/**
 * The complete list of secure-storage keys owned by the auth package.
 *
 * Keys must satisfy the secure-store charset (alphanumerics + `._-`),
 * so they cannot use the `prefix/local` keyword grammar from
 * {@link @pkgs/keyword-shared}. Each value is a small identifier (UUID or
 * short JWT) and fits well inside the 2048-byte cap enforced by
 * `wrapSecureStorage`.
 */

/** Stable per-install device UUID. Populated on first cold start. */
export const DEVICE_ID_KEY = 'deviceId';

/** Bearer session token from the auth adapter. Sent on every sync upload request. */
export const SESSION_TOKEN_KEY = 'sessionToken';

/**
 * ISO expiry of the install's auth-provider session. Written when AuthBridge
 * mints/refreshes the bearer; used for local-first chrome without BA reads.
 */
export const SESSION_EXPIRES_AT_KEY = 'sessionExpiresAt';

/**
 * Auth-provider external user id for the current install session. Used to
 * detect account switches without relying on continuous BA `useSession`.
 */
export const SESSION_EXTERNAL_USER_ID_KEY = 'sessionExternalUserId';

/**
 * Current `users.id` for this install (anon or signed-in). Written by
 * `POST /identity/anon/ensure` and `POST /identity/refresh`. Storage key kept as
 * `lastLocalAccountId` for existing installs.
 */
export const LAST_LOCAL_ACCOUNT_ID_KEY = 'lastLocalAccountId';

/**
 * JSON payload (or legacy bare ISO timestamp) recorded when a sign-in flow
 * starts. Survives the OAuth redirect (full page unload on web) so the
 * sign-in modal can resume into its loading state and report the outcome once
 * the session resolves.
 */
export const SIGN_IN_PENDING_KEY = 'signInPending';

/**
 * JSON `{ "unshared": <count> }` recorded when this device learns its sign-in
 * ended without the person asking here (signed out everywhere, or lapsed).
 * Kept until they dismiss the notice or sign in again, across app restarts.
 */
export const SIGNED_OUT_NOTICE_KEY = 'signedOutNotice';
