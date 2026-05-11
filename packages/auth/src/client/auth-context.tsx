import { createAuthService, type AuthService } from './auth-service';
import {
  authActionsAtom,
  authSessionDerivedAtom,
  authSessionSyncEffect,
  authSignOutModalCallbacksAtom,
  deriveStateFromSession,
  hostedAuthUiAtom,
  signInModalOpenAtom,
  signOutConfirmOpenAtom,
} from './auth-atoms';
import { HostedAuthRuntime } from './hosted-auth-runtime';
import type { EnsureProfileFn } from './finalize-local-sign-in';
import { useHostedAuthPorts } from './hosted-auth-ports-context';
import type { HostedAuthUiPort } from './ports';
import type { AccountSessionRecord } from './session-service';
import { SignInModal } from './sign-in-modal';
import { useSignOutConfirmationModal } from './use-sign-out-confirmation';
import {
  useDeviceService,
  useSessionService,
} from '@gamezilla/client-runtime/runtime-hooks';
import { IdentityProvider } from '@gamezilla/client-runtime/identity-context';
import { getDefaultStore, useAtom, useAtomValue } from 'jotai';
import { useCallback, useLayoutEffect, useMemo, type ReactNode } from 'react';

export type AuthState = {
  deviceId: string;
  accountId: string | null;
  isAuthenticated: boolean;
  myId: string;
  session: AccountSessionRecord | null;
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

function AuthAtomsMount() {
  useAtom(authSessionSyncEffect);
  return null;
}

function useAuthActionsSync(args: {
  authService: AuthService;
  refreshSession: () => Promise<void>;
}) {
  const { authService, refreshSession } = args;
  const signInWithHosted = useCallback(async () => {
    await authService.startHostedSignIn();
    await refreshSession();
  }, [authService, refreshSession]);
  const signOut = useCallback(async () => {
    await authService.signOut();
    await refreshSession();
  }, [authService, refreshSession]);

  useLayoutEffect(() => {
    getDefaultStore().set(authActionsAtom, {
      signInWithHosted,
      signOut,
      refreshSession,
    });
    return () => {
      getDefaultStore().set(authActionsAtom, {
        signInWithHosted: async () => {
          throw new Error('AuthProvider not mounted');
        },
        signOut: async () => {
          throw new Error('AuthProvider not mounted');
        },
        refreshSession: async () => {},
      });
    };
  }, [signInWithHosted, signOut, refreshSession]);
}

function AuthActionsMount() {
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
  const deviceId = deviceService.getDeviceId();

  const refreshSession = useCallback(async () => {
    await sessionService.refresh();
    getDefaultStore().set(
      authSessionDerivedAtom,
      deriveStateFromSession({ deviceId, sessionService })
    );
  }, [deviceId, sessionService]);

  useAuthActionsSync({ authService, refreshSession });

  return null;
}

function AuthModals() {
  const [signInModalOpen, setSignInModalOpen] = useAtom(signInModalOpenAtom);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useAtom(
    signOutConfirmOpenAtom
  );
  const hostedUi = useAtomValue(hostedAuthUiAtom);
  const actions = useAtomValue(authActionsAtom);

  const { openSignOutConfirm, closeSignOutConfirm, modal } =
    useSignOutConfirmationModal({
      signOut: actions.signOut,
      signOutConfirmOpen,
      openSignOutConfirmBase: () => setSignOutConfirmOpen(true),
      closeSignOutConfirmBase: () => setSignOutConfirmOpen(false),
    });

  useLayoutEffect(() => {
    getDefaultStore().set(authSignOutModalCallbacksAtom, {
      openSignOutConfirm,
      closeSignOutConfirm,
    });
    return () => {
      getDefaultStore().set(authSignOutModalCallbacksAtom, {
        openSignOutConfirm: () => {
          throw new Error('AuthProvider not mounted');
        },
        closeSignOutConfirm: () => {},
      });
    };
  }, [openSignOutConfirm, closeSignOutConfirm]);

  return (
    <>
      <SignInModal
        visible={signInModalOpen}
        onClose={() => setSignInModalOpen(false)}
        hostedUi={hostedUi}
        onSignInWithHosted={actions.signInWithHosted}
      />
      {modal}
    </>
  );
}

function AuthIdentityBridge({ children }: { children: ReactNode }) {
  const derived = useAtomValue(authSessionDerivedAtom);
  const identity = useMemo(
    () => ({
      deviceId: derived.deviceId,
      accountId: derived.accountId,
      myId: derived.myId,
    }),
    [derived.deviceId, derived.accountId, derived.myId]
  );
  return <IdentityProvider value={identity}>{children}</IdentityProvider>;
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthActionsMount />
      <AuthModals />
      <AuthIdentityBridge>{children}</AuthIdentityBridge>
    </>
  );
}

export function AuthProvider({
  children,
  ensureProfile,
}: {
  children: ReactNode;
  ensureProfile: EnsureProfileFn;
}) {
  return (
    <>
      <AuthAtomsMount />
      <HostedAuthRuntime ensureProfile={ensureProfile}>
        <AuthShell>{children}</AuthShell>
      </HostedAuthRuntime>
    </>
  );
}

export function useAuth(): AuthState {
  const derived = useAtomValue(authSessionDerivedAtom);
  const hostedUi = useAtomValue(hostedAuthUiAtom);
  const [signInModalOpen, setSignInModalOpen] = useAtom(signInModalOpenAtom);
  const [signOutConfirmOpen] = useAtom(signOutConfirmOpenAtom);
  const signOutCallbacks = useAtomValue(authSignOutModalCallbacksAtom);
  const actions = useAtomValue(authActionsAtom);

  return useMemo<AuthState>(
    () => ({
      ...derived,
      providers: { hosted: hostedUi },
      signInModalOpen,
      openSignInModal: () => setSignInModalOpen(true),
      closeSignInModal: () => setSignInModalOpen(false),
      signOutConfirmOpen,
      openSignOutConfirm: signOutCallbacks.openSignOutConfirm,
      closeSignOutConfirm: signOutCallbacks.closeSignOutConfirm,
      signInWithHosted: actions.signInWithHosted,
      signOut: actions.signOut,
      refreshSession: actions.refreshSession,
    }),
    [
      derived,
      hostedUi,
      signInModalOpen,
      setSignInModalOpen,
      signOutConfirmOpen,
      signOutCallbacks.openSignOutConfirm,
      signOutCallbacks.closeSignOutConfirm,
      actions.signInWithHosted,
      actions.signOut,
      actions.refreshSession,
    ]
  );
}

/** Signed-in → `accountId`, else install `deviceId`. */
export function useMyId(): string {
  return useAuth().myId;
}
