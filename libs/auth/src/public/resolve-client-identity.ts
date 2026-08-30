/**
 * Pure identity resolution for signed-in / myId. Kept free of React so unit
 * tests can cover the race matrix without mounting hooks.
 */

export function resolveIsSignedIn(
  userId: string | null,
  token: string | null,
  isAnon: boolean
): boolean {
  return userId !== null && token !== null && !isAnon;
}

/**
 * Current user id from secure storage. Empty only before anon ensure lands.
 */
export function resolveMyId(userId: string | null): string {
  return userId ?? '';
}

/**
 * True when the auth-port external user id changed across accounts without a
 * signed-out intermediate — stale `currentUserId` must clear before refresh.
 */
export function shouldClearAccountOnExternalUserChange(
  previousExternalUserId: string | null,
  nextExternalUserId: string | null,
  isSessionSignedIn: boolean
): boolean {
  return (
    isSessionSignedIn &&
    previousExternalUserId !== null &&
    nextExternalUserId !== null &&
    previousExternalUserId !== nextExternalUserId
  );
}

/**
 * After `POST /identity/anon/ensure` returns, only bind the anon `users.id` when
 * no session token landed while the request was in flight. Otherwise a stale
 * signed-out ensure overwrites the signed-in account id and refresh is skipped.
 */
export function shouldBindAnonUserAfterEnsure(
  sessionToken: string | null
): boolean {
  return sessionToken === null;
}

/**
 * When IdP reports signed-out: clear local capability only if there is
 * no stored bearer, or we observed a signed-in → signed-out transition (real
 * sign-out). A cold BA null with a persisted token keeps local-first chrome.
 */
export function shouldClearCapabilityOnBaSignedOut(args: {
  readonly storedToken: string | null;
  readonly wasBaSignedIn: boolean;
}): boolean {
  if (args.storedToken === null) return true;
  return args.wasBaSignedIn;
}
