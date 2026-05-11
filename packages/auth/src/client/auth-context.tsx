import { usePatchDbStack } from '@gamezilla/patch-db/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { ACCOUNT_SESSION_ENTITY_TYPE, AccountSessionAttr } from '../shared';
import { createAuthService } from './auth-service';
import { deriveStateFromSession, type SessionDerivedState } from './auth-atoms';
import { useClientStore } from './client-store-context';
import { useDeviceService } from './device-service-context';
import type { EnsureProfileFn } from './finalize-local-sign-in';
import { deriveHostedAuthUiFromApiUrl } from './hosted-auth-ui';
import { HostedAuthRuntime } from './hosted-auth-runtime';
import { useHostedAuthPorts } from './hosted-auth-ports-context';
import { IdentityProvider } from './identity-context';
import type { HostedAuthUiPort } from './ports';
import { SignInModal } from './sign-in-modal';
import { useSessionService } from './session-service-context';
import { useSignOutConfirmationModal } from './use-sign-out-confirmation';

const emptyDerived: SessionDerivedState = {
  deviceId: '',
  session: null,
  accountId: null,
  isAuthenticated: false,
  myId: '',
};

export type AuthState = {
  deviceId: string;
  accountId: string | null;
  isAuthenticated: boolean;
  myId: string;
  session: SessionDerivedState['session'];
  providers: { hosted: HostedAuthUiPort };
  signInModalOpen: boolean;
  openSignInModal: () => void;
  closeSignInModal: () => void;
  signOutConfirmOpen: boolean;
  openSignOutConfirm: () => void;
  closeSignOutConfirm: () => void;
  signInWithHosted: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthStateContext = createContext<AuthState | null>(null);

const authNotMountedAsync = async (): Promise<void> => {
  throw new Error('AuthProvider not mounted');
};

type AuthActions = {
  signInWithHosted: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const defaultActions: AuthActions = {
  signInWithHosted: authNotMountedAsync,
  signOut: authNotMountedAsync,
  refreshSession: async () => {},
};

function AuthSessionSync({
  setDerived,
}: {
  setDerived: (next: SessionDerivedState) => void;
}): null {
  const store = useClientStore();
  const deviceService = useDeviceService();
  const sessionService = useSessionService();
  const stack = usePatchDbStack();
  const deviceId = deviceService.getDeviceId();

  const pushDerived = useCallback(async () => {
    try {
      await sessionService.refresh();
      setDerived(
        deriveStateFromSession({
          deviceId,
          sessionService,
          sessionToken: store.getSessionToken(),
          accountIdFromStore: store.getAccountId(),
        })
      );
    } catch {
      // Stale `sessionService.refresh` after stack replacement.
    }
  }, [deviceId, sessionService, setDerived, store]);

  useEffect(() => {
    return store.subscribe(() => {
      void pushDerived();
    });
  }, [store, pushDerived]);

  useEffect(() => {
    void pushDerived();
  }, [pushDerived, stack]);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

    void (async () => {
      try {
        await pushDerived();
        if (cancelled) return;
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
        // Stale derivation transients.
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [stack, deviceId, pushDerived]);

  return null;
}

function AuthActionsMount({
  setDerived,
  actionsRef,
}: {
  setDerived: (next: SessionDerivedState) => void;
  actionsRef: React.MutableRefObject<AuthActions>;
}): null {
  const ports = useHostedAuthPorts();
  const startHostedSignIn = useCallback(async () => {
    await ports.signIn.startSignIn();
  }, [ports]);
  const hostedSignOut = useCallback(async () => {
    await ports.signIn.signOut();
  }, [ports]);
  const authService = useMemo(
    () =>
      createAuthService({
        startHostedSignIn,
        hostedSignOut,
      }),
    [startHostedSignIn, hostedSignOut]
  );

  const deviceService = useDeviceService();
  const sessionService = useSessionService();
  const store = useClientStore();
  const deviceId = deviceService.getDeviceId();

  const refreshSession = useCallback(async () => {
    await sessionService.refresh();
    setDerived(
      deriveStateFromSession({
        deviceId,
        sessionService,
        sessionToken: store.getSessionToken(),
        accountIdFromStore: store.getAccountId(),
      })
    );
  }, [deviceId, sessionService, setDerived, store]);

  const signInWithHosted = useCallback(async () => {
    await authService.startHostedSignIn();
    await refreshSession();
  }, [authService, refreshSession]);

  const signOut = useCallback(async () => {
    await authService.signOut();
    await refreshSession();
  }, [authService, refreshSession]);

  useLayoutEffect(() => {
    actionsRef.current = {
      signInWithHosted,
      signOut,
      refreshSession,
    };
    return () => {
      actionsRef.current = defaultActions;
    };
  }, [actionsRef, signInWithHosted, signOut, refreshSession]);

  return null;
}

function AuthModals({
  actionsRef,
  signOutCallbacksRef,
  signInModalOpen,
  setSignInModalOpen,
  signOutConfirmOpen,
  setSignOutConfirmOpen,
  hostedUi,
}: {
  actionsRef: React.MutableRefObject<AuthActions>;
  signOutCallbacksRef: React.MutableRefObject<{
    openSignOutConfirm: () => void;
    closeSignOutConfirm: () => void;
  }>;
  signInModalOpen: boolean;
  setSignInModalOpen: (v: boolean) => void;
  signOutConfirmOpen: boolean;
  setSignOutConfirmOpen: (v: boolean) => void;
  hostedUi: HostedAuthUiPort;
}): ReactNode {
  const { openSignOutConfirm, closeSignOutConfirm, modal } =
    useSignOutConfirmationModal({
      signOut: () => actionsRef.current.signOut(),
      signOutConfirmOpen,
      openSignOutConfirmBase: () => setSignOutConfirmOpen(true),
      closeSignOutConfirmBase: () => setSignOutConfirmOpen(false),
    });

  useLayoutEffect(() => {
    signOutCallbacksRef.current = {
      openSignOutConfirm,
      closeSignOutConfirm,
    };
    return () => {
      signOutCallbacksRef.current = {
        openSignOutConfirm: () => {
          throw new Error('AuthProvider not mounted');
        },
        closeSignOutConfirm: () => {},
      };
    };
  }, [openSignOutConfirm, closeSignOutConfirm, signOutCallbacksRef]);

  return (
    <>
      <SignInModal
        visible={signInModalOpen}
        onClose={() => setSignInModalOpen(false)}
        hostedUi={hostedUi}
        onSignInWithHosted={() => actionsRef.current.signInWithHosted()}
      />
      {modal}
    </>
  );
}

function AuthShell({ children }: { children: ReactNode }): ReactNode {
  const [derived, setDerived] = useState<SessionDerivedState>(emptyDerived);
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const store = useClientStore();
  const actionsRef = useRef<AuthActions>(defaultActions);
  const signOutCallbacksRef = useRef({
    openSignOutConfirm: () => {
      throw new Error('AuthProvider not mounted');
    },
    closeSignOutConfirm: () => {},
  });

  const hostedUi = useMemo(
    () => deriveHostedAuthUiFromApiUrl(store.getConfigService().getApiUrl()),
    [store]
  );

  const identity = useMemo(
    () => ({
      deviceId: derived.deviceId,
      accountId: derived.accountId,
      myId: derived.myId,
    }),
    [derived.deviceId, derived.accountId, derived.myId]
  );

  const authState = useMemo<AuthState>(
    () => ({
      ...derived,
      providers: { hosted: hostedUi },
      signInModalOpen,
      openSignInModal: () => setSignInModalOpen(true),
      closeSignInModal: () => setSignInModalOpen(false),
      signOutConfirmOpen,
      openSignOutConfirm: () =>
        signOutCallbacksRef.current.openSignOutConfirm(),
      closeSignOutConfirm: () =>
        signOutCallbacksRef.current.closeSignOutConfirm(),
      signInWithHosted: () => actionsRef.current.signInWithHosted(),
      signOut: () => actionsRef.current.signOut(),
      refreshSession: () => actionsRef.current.refreshSession(),
    }),
    [derived, hostedUi, signInModalOpen, signOutConfirmOpen]
  );

  return (
    <AuthStateContext.Provider value={authState}>
      <AuthSessionSync setDerived={setDerived} />
      <AuthActionsMount setDerived={setDerived} actionsRef={actionsRef} />
      <AuthModals
        actionsRef={actionsRef}
        signOutCallbacksRef={signOutCallbacksRef}
        signInModalOpen={signInModalOpen}
        setSignInModalOpen={setSignInModalOpen}
        signOutConfirmOpen={signOutConfirmOpen}
        setSignOutConfirmOpen={setSignOutConfirmOpen}
        hostedUi={hostedUi}
      />
      <IdentityProvider value={identity}>{children}</IdentityProvider>
    </AuthStateContext.Provider>
  );
}

export function AuthProvider({
  children,
  ensureProfile,
}: {
  children: ReactNode;
  ensureProfile: EnsureProfileFn;
}): ReactNode {
  return (
    <HostedAuthRuntime ensureProfile={ensureProfile}>
      <AuthShell>{children}</AuthShell>
    </HostedAuthRuntime>
  );
}

export function useAuth(): AuthState {
  const v = useContext(AuthStateContext);
  if (v === null) {
    throw new Error('useAuth: missing AuthProvider');
  }
  return v;
}

export { useMyId } from './identity-context';
