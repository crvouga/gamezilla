import type { AccountSessionRecord, SessionService } from './session-service';

export type SessionDerivedState = {
  deviceId: string;
  session: AccountSessionRecord | null;
  accountId: string | null;
  /** True when session JWT + internal account id are present (or legacy PatchDB session). */
  isAuthenticated: boolean;
  /**
   * Replication identity: `accountId` when signed in, else install `deviceId`.
   */
  myId: string;
};

export const emptyDerived: SessionDerivedState = {
  deviceId: '',
  session: null,
  accountId: null,
  isAuthenticated: false,
  myId: '',
};

function resolveReplicationIdentity(args: {
  deviceId: string;
  isAuthenticated: boolean;
  accountId: string | null;
}): string {
  const { deviceId, isAuthenticated, accountId } = args;
  if (isAuthenticated && accountId !== null && accountId.length > 0) {
    return accountId;
  }
  return deviceId;
}

export function deriveStateFromSession(args: {
  deviceId: string;
  sessionService: SessionService;
  sessionToken: string | null;
  accountIdFromStore: string | null;
}): SessionDerivedState {
  const { deviceId, sessionService, sessionToken, accountIdFromStore } = args;
  const session = sessionService.getSession();
  const legacyAuth = session !== null && sessionService.isAuthenticated();
  const hasHostedToken =
    typeof sessionToken === 'string' && sessionToken.length > 0;
  const hasAccount =
    accountIdFromStore !== null && accountIdFromStore.length > 0;
  const hostedAuth = hasHostedToken && hasAccount;
  const isAuthenticated = hostedAuth || legacyAuth;
  const accountId = hostedAuth
    ? accountIdFromStore
    : legacyAuth
      ? session!.accountId
      : null;
  const myId = resolveReplicationIdentity({
    deviceId,
    isAuthenticated,
    accountId,
  });
  return {
    deviceId,
    session,
    accountId,
    isAuthenticated,
    myId,
  };
}
