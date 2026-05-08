import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountSessionAttr,
} from '@gamezilla/domain/auth';
import {
  accountIdAtom,
  configServiceAtom,
  deviceServiceAtom,
  patchDbStackAtom,
  sessionServiceAtom,
  sessionTokenAtom,
} from '@gamezilla/client/runtime/atoms';
import { atom, getDefaultStore } from 'jotai';
import { atomEffect } from 'jotai-effect';
import { deriveHostedAuthUiFromApiUrl } from './hosted-auth-ui';
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
}): SessionDerivedState {
  const { deviceId, sessionService } = args;
  const store = getDefaultStore();
  const token = store.get(sessionTokenAtom);
  const accountIdFromAtom = store.get(accountIdAtom);
  const session = sessionService.getSession();
  const legacyAuth = session !== null && sessionService.isAuthenticated();
  const hasHostedToken = typeof token === 'string' && token.length > 0;
  const hasAccount = accountIdFromAtom !== null && accountIdFromAtom.length > 0;
  const hostedAuth = hasHostedToken && hasAccount;
  const isAuthenticated = hostedAuth || legacyAuth;
  const accountId = hostedAuth
    ? accountIdFromAtom
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

export const authSessionDerivedAtom = atom<SessionDerivedState>({
  deviceId: '',
  session: null,
  accountId: null,
  isAuthenticated: false,
  myId: '',
});

/**
 * Keeps {@link authSessionDerivedAtom} in sync with PatchDB account-session rows
 * for this device, hosted session token, and {@link accountIdAtom}.
 */
export const authSessionSyncEffect = atomEffect((get, set) => {
  let cancelled = false;
  let unsub: (() => void) | null = null;

  get(accountIdAtom);
  get(sessionTokenAtom);

  void (async () => {
    try {
      const deviceService = await get(deviceServiceAtom);
      const sessionService = await get(sessionServiceAtom);
      const stack = await get(patchDbStackAtom);
      if (cancelled) return;

      const deviceId = deviceService.getDeviceId();

      const pushDerived = async () => {
        if (cancelled) return;
        try {
          await sessionService.refresh();
          if (cancelled) return;
          set(
            authSessionDerivedAtom,
            deriveStateFromSession({ deviceId, sessionService })
          );
        } catch {
          // Stale `sessionService.refresh` after `sqlClientAtom` was replaced
          // mid-flight. Silently drop — a fresh effect run will derive again.
        }
      };

      await pushDerived();

      unsub = stack.decorated.subscribe.entities(
        {
          entityType: ACCOUNT_SESSION_ENTITY_TYPE,
          where: {
            type: '=',
            attribute: AccountSessionAttr.deviceId.key,
            value: deviceId,
          },
        },
        () => {
          void pushDerived();
        }
      );
    } catch {
      // Same rationale as `entityBootstrapEffect` — stale derivation transients.
    }
  })();

  return () => {
    cancelled = true;
    unsub?.();
  };
});

export const hostedAuthUiAtom = atom((get) =>
  deriveHostedAuthUiFromApiUrl(get(configServiceAtom).getApiUrl())
);

export const signInModalOpenAtom = atom(false);
export const signOutConfirmOpenAtom = atom(false);

const authNotMountedAsync = async (): Promise<void> => {
  throw new Error('AuthProvider not mounted');
};

export const authActionsAtom = atom<{
  signInWithHosted: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}>({
  signInWithHosted: authNotMountedAsync,
  signOut: authNotMountedAsync,
  refreshSession: async () => {},
});

export const authSignOutModalCallbacksAtom = atom<{
  openSignOutConfirm: () => void;
  closeSignOutConfirm: () => void;
}>({
  openSignOutConfirm: () => {
    throw new Error('AuthProvider not mounted');
  },
  closeSignOutConfirm: () => {},
});
