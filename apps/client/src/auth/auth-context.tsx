import type { AuthGoogleProviderState } from './auth-capabilities';
import { createAuthService, type AuthService } from './auth-service';
import {
  authActionsAtom,
  authSessionDerivedAtom,
  authSessionSyncEffect,
  authSignOutModalCallbacksAtom,
  deriveStateFromSession,
  googleProviderAtom,
  googleWebClientIdAtom,
  googleWebClientIdSyncEffect,
  signInModalOpenAtom,
  signOutConfirmOpenAtom,
} from './auth-atoms';
import type { AccountSessionRecord } from './session-service';
import { SignInModal } from './sign-in-modal';
import { useGoogleIdTokenPrompt } from './use-google-id-token-prompt';
import { useSignOutConfirmationModal } from './use-sign-out-confirmation';
import {
  useConfigService,
  useDeviceService,
  useSessionService,
} from '@gamezilla/client/runtime/runtime-hooks';
import { getDefaultStore, useAtom, useAtomValue } from 'jotai';
import { useCallback, useLayoutEffect, useMemo, type ReactNode } from 'react';

export type AuthState = {
  mode: 'guest' | 'signed-in';
  displayName: string;
  deviceId: string;
  accountId: string | null;
  session: AccountSessionRecord | null;
  /** Google OAuth availability from synced client config. */
  providers: { google: AuthGoogleProviderState };
  signInModalOpen: boolean;
  openSignInModal: () => void;
  closeSignInModal: () => void;
  signOutConfirmOpen: boolean;
  /** Opens the sign-out confirmation modal; prefer this over calling {@link signOut} directly from UI. */
  openSignOutConfirm: () => void;
  closeSignOutConfirm: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

function AuthAtomsMount() {
  useAtom(authSessionSyncEffect);
  useAtom(googleWebClientIdSyncEffect);
  return null;
}

function useAuthActionsSync(args: {
  authService: AuthService;
  refreshSession: () => Promise<void>;
}) {
  const { authService, refreshSession } = args;
  const signInWithGoogle = useCallback(async () => {
    await authService.signInWithGoogle();
    await refreshSession();
  }, [authService, refreshSession]);
  const signOut = useCallback(async () => {
    await authService.signOut();
    await refreshSession();
  }, [authService, refreshSession]);

  useLayoutEffect(() => {
    getDefaultStore().set(authActionsAtom, {
      signInWithGoogle,
      signOut,
      refreshSession,
    });
    return () => {
      getDefaultStore().set(authActionsAtom, {
        signInWithGoogle: async () => {
          throw new Error('AuthProvider not mounted');
        },
        signOut: async () => {
          throw new Error('AuthProvider not mounted');
        },
        refreshSession: async () => {},
      });
    };
  }, [signInWithGoogle, signOut, refreshSession]);
}

function AuthActionsBridge({
  children,
  promptGoogleIdToken,
  googleProvider,
}: {
  children: ReactNode;
  promptGoogleIdToken: () => Promise<string>;
  googleProvider: AuthGoogleProviderState;
}) {
  const configService = useConfigService();
  const deviceService = useDeviceService();
  const sessionService = useSessionService();
  const deviceId = deviceService.getDeviceId();

  const authService = useMemo(
    () =>
      createAuthService({
        configService,
        deviceService,
        googleSignInAvailable: googleProvider.available,
        promptGoogleIdToken,
      }),
    [
      configService,
      deviceService,
      googleProvider.available,
      promptGoogleIdToken,
    ]
  );

  const refreshSession = useCallback(async () => {
    await sessionService.refresh();
    getDefaultStore().set(
      authSessionDerivedAtom,
      deriveStateFromSession({ deviceId, sessionService })
    );
  }, [deviceId, sessionService]);

  useAuthActionsSync({ authService, refreshSession });

  return <>{children}</>;
}

function AuthModals() {
  const [signInModalOpen, setSignInModalOpen] = useAtom(signInModalOpenAtom);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useAtom(
    signOutConfirmOpenAtom
  );
  const googleProvider = useAtomValue(googleProviderAtom);
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
        google={googleProvider}
        onSignInWithGoogle={actions.signInWithGoogle}
      />
      {modal}
    </>
  );
}

function AuthWithGoogleBridge({
  children,
  googleWebClientId,
  googleProvider,
}: {
  children: ReactNode;
  googleWebClientId: string;
  googleProvider: AuthGoogleProviderState;
}) {
  const promptGoogleIdToken = useGoogleIdTokenPrompt(googleWebClientId);
  return (
    <AuthActionsBridge
      promptGoogleIdToken={promptGoogleIdToken}
      googleProvider={googleProvider}
    >
      {children}
    </AuthActionsBridge>
  );
}

function AuthStubGoogleBridge({
  children,
  googleProvider,
}: {
  children: ReactNode;
  googleProvider: AuthGoogleProviderState;
}) {
  const promptGoogleIdTokenUnreachable =
    useCallback(async (): Promise<string> => {
      throw new Error(
        'Google sign-in prompt should not run when Google is unavailable'
      );
    }, []);

  return (
    <AuthActionsBridge
      promptGoogleIdToken={promptGoogleIdTokenUnreachable}
      googleProvider={googleProvider}
    >
      {children}
    </AuthActionsBridge>
  );
}

function AuthGoogleRouter({ children }: { children: ReactNode }) {
  const googleWebClientId = useAtomValue(googleWebClientIdAtom);
  const googleProvider = useAtomValue(googleProviderAtom);

  if (googleWebClientId !== null) {
    return (
      <AuthWithGoogleBridge
        googleWebClientId={googleWebClientId}
        googleProvider={googleProvider}
      >
        <AuthModals />
        {children}
      </AuthWithGoogleBridge>
    );
  }

  return (
    <AuthStubGoogleBridge googleProvider={googleProvider}>
      <AuthModals />
      {children}
    </AuthStubGoogleBridge>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthAtomsMount />
      <AuthGoogleRouter>{children}</AuthGoogleRouter>
    </>
  );
}

export function useAuth(): AuthState {
  const derived = useAtomValue(authSessionDerivedAtom);
  const googleProvider = useAtomValue(googleProviderAtom);
  const [signInModalOpen, setSignInModalOpen] = useAtom(signInModalOpenAtom);
  const [signOutConfirmOpen] = useAtom(signOutConfirmOpenAtom);
  const signOutCallbacks = useAtomValue(authSignOutModalCallbacksAtom);
  const actions = useAtomValue(authActionsAtom);

  return useMemo<AuthState>(
    () => ({
      ...derived,
      providers: { google: googleProvider },
      signInModalOpen,
      openSignInModal: () => setSignInModalOpen(true),
      closeSignInModal: () => setSignInModalOpen(false),
      signOutConfirmOpen,
      openSignOutConfirm: signOutCallbacks.openSignOutConfirm,
      closeSignOutConfirm: signOutCallbacks.closeSignOutConfirm,
      signInWithGoogle: actions.signInWithGoogle,
      signOut: actions.signOut,
      refreshSession: actions.refreshSession,
    }),
    [
      derived,
      googleProvider,
      signInModalOpen,
      setSignInModalOpen,
      signOutConfirmOpen,
      signOutCallbacks.openSignOutConfirm,
      signOutCallbacks.closeSignOutConfirm,
      actions.signInWithGoogle,
      actions.signOut,
      actions.refreshSession,
    ]
  );
}
