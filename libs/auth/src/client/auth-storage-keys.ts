/**
 * The complete list of secure-storage keys owned by the auth package.
 *
 * Keys must satisfy `expo-secure-store`'s charset (alphanumerics + `._-`),
 * so they cannot use the `prefix/local` keyword grammar from
 * {@link @pkgs/keyword}. Each value is a small identifier (UUID or
 * short JWT) and fits well inside the 2048-byte cap enforced by
 * `wrapSecureStorage`.
 */

/** Stable per-install device UUID. Populated on first cold start. */
export const DEVICE_ID_KEY = 'deviceId';

/** Bearer session token from the auth adapter. Sent on every sync upload request. */
export const SESSION_TOKEN_KEY = 'sessionToken';

/**
 * Current `users.id` for this install (anon or signed-in). Written by
 * `POST /auth/anon/ensure` and `POST /auth/refresh`. Storage key kept as
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
