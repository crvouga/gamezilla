import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountSessionAttr,
} from '@gamezilla/domain/auth';
import {
  CLIENT_CONFIG_ENTITY_ID,
  CLIENT_CONFIG_ENTITY_TYPE,
  ClientConfigAttr,
} from '@gamezilla/domain/client-config/client-config-entities';
import {
  accountIdAtom,
  deviceServiceAtom,
  patchDbStackAtom,
  sessionServiceAtom,
} from '@gamezilla/client/runtime/atoms';
import { atom } from 'jotai';
import { atomEffect } from 'jotai-effect';
import { deriveGoogleProviderState } from './auth-capabilities';
import type { AccountSessionRecord, SessionService } from './session-service';

export type SessionDerivedState = {
  deviceId: string;
  session: AccountSessionRecord | null;
  accountId: string | null;
  /** True when PatchDB session is authenticated (valid bearer-backed session row). */
  isAuthenticated: boolean;
  /**
   * Replication identity: `accountId` when signed in, else install `deviceId`.
   */
  myId: string;
};

export function deriveStateFromSession(args: {
  deviceId: string;
  sessionService: SessionService;
}): SessionDerivedState {
  const { deviceId, sessionService } = args;
  const session = sessionService.getSession();
  const isAuthenticated =
    session !== null && sessionService.isAuthenticated();
  const accountId = session?.accountId ?? null;
  const myId =
    isAuthenticated && accountId !== null && accountId.length > 0
      ? accountId
      : deviceId;
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
 * for this device and with {@link accountIdAtom} (see SYNC.md — never mutate
 * session tokens from here).
 */
export const authSessionSyncEffect = atomEffect((get, set) => {
  let cancelled = false;
  let unsub: (() => void) | null = null;

  get(accountIdAtom);

  void (async () => {
    const deviceService = await get(deviceServiceAtom);
    const sessionService = await get(sessionServiceAtom);
    const stack = await get(patchDbStackAtom);
    if (cancelled) return;

    const deviceId = deviceService.getDeviceId();

    const pushDerived = async () => {
      if (cancelled) return;
      await sessionService.refresh();
      if (cancelled) return;
      set(
        authSessionDerivedAtom,
        deriveStateFromSession({ deviceId, sessionService })
      );
    };

    await pushDerived();

    unsub = stack.decorated.subscribe.entities(
      {
        entityType: ACCOUNT_SESSION_ENTITY_TYPE,
        where: {
          type: '=',
          attribute: AccountSessionAttr.deviceId,
          value: deviceId,
        },
      },
      () => {
        void pushDerived();
      }
    );
  })();

  return () => {
    cancelled = true;
    unsub?.();
  };
});

function parseGoogleWebClientIdFromEntity(
  entity: { attributes: Record<string, unknown> } | undefined
): string | null {
  if (entity === undefined) return null;
  const raw = entity.attributes[ClientConfigAttr.googleWebClientId];
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
}

export const googleWebClientIdAtom = atom<string | null>(null);

export const googleWebClientIdSyncEffect = atomEffect((get, set) => {
  let cancelled = false;
  let unsub: (() => void) | null = null;

  void (async () => {
    const stack = await get(patchDbStackAtom);
    if (cancelled) return;
    const subDb = stack.decorated;

    const push = async () => {
      if (cancelled) return;
      const [result] = await subDb.read([
        {
          entityType: CLIENT_CONFIG_ENTITY_TYPE,
          entityId: CLIENT_CONFIG_ENTITY_ID,
        },
      ]);
      const entity = result?.entities[0];
      set(googleWebClientIdAtom, parseGoogleWebClientIdFromEntity(entity));
    };

    await push();

    unsub = subDb.subscribe.entities(
      {
        entityType: CLIENT_CONFIG_ENTITY_TYPE,
        entityId: CLIENT_CONFIG_ENTITY_ID,
      },
      () => {
        void push();
      }
    );
  })();

  return () => {
    cancelled = true;
    unsub?.();
  };
});

export const googleProviderAtom = atom((get) =>
  deriveGoogleProviderState(get(googleWebClientIdAtom))
);

export const signInModalOpenAtom = atom(false);
export const signOutConfirmOpenAtom = atom(false);

const authNotMountedAsync = async (): Promise<void> => {
  throw new Error('AuthProvider not mounted');
};

export const authActionsAtom = atom<{
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}>({
  signInWithGoogle: authNotMountedAsync,
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
