/**
 * Pure identity resolution for signed-in / myId. Kept free of React so unit
 * tests can cover the sign-in race matrix without mounting hooks.
 */

export function resolveIsSignedIn(
  accountId: string | null,
  token: string | null
): boolean {
  return accountId !== null && token !== null;
}

export type ResolveMyIdInput = {
  readonly accountId: string | null;
  readonly cachedAccountId: string | null;
  readonly token: string | null;
  readonly deviceId: string | null;
};

/**
 * Replication identity: account id when bound, empty while a session token is
 * waiting for `lastLocalAccountId`, else the install device id.
 */
export function resolveMyId(input: ResolveMyIdInput): string {
  if (input.accountId !== null) return input.accountId;
  if (input.token !== null) {
    if (input.cachedAccountId !== null) return input.cachedAccountId;
    return '';
  }
  return input.deviceId ?? '';
}

/**
 * True when the auth-port external user id changed across accounts without a
 * signed-out intermediate — stale `lastLocalAccountId` must clear.
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
