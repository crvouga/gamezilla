import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountSessionAttr,
} from '@gamezilla/domain/auth';
import {
  CLIENT_CONFIG_ENTITY_ID,
  CLIENT_CONFIG_ENTITY_TYPE,
  ClientConfigAttr,
} from '@gamezilla/domain/client-config/client-config-entities';
import { useConfigService } from '@gamezilla/domain/config/config-service';
import { writeLastLocalAccountId } from '@gamezilla/client/db/account-local-state';
import {
  accountIdAtom,
  sessionTokenAtom,
} from '@gamezilla/client/runtime/atoms';
import { useLogger } from '@gamezilla/lib/logger/react';
import {
  useSecureStorage,
  type SecureStorage,
} from '@gamezilla/lib/secure-storage/interface';
import { ConfirmationModal } from '@gamezilla/lib/ui';
import { usePatchDbStack, useQueryOne } from '@gamezilla/patch-db/react';
import { Trans } from '@lingui/react/macro';
import { getDefaultStore } from 'jotai';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import type { AuthGoogleProviderState } from './auth-capabilities';
import { deriveGoogleProviderState } from './auth-capabilities';
import { createAuthService, type AuthService } from './auth-service';
import {
  useDeviceService,
  useSessionService,
} from '../runtime/runtime-contexts';
import {
  type AccountSessionRecord,
  type SessionService,
} from './session-service';
import { SignInModal } from './sign-in-modal';
import { useGoogleIdTokenPrompt } from './use-google-id-token-prompt';

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

const defaultSignIn = async (): Promise<void> => {
  throw new Error('AuthProvider not mounted');
};
const defaultSignOut = async (): Promise<void> => {
  throw new Error('AuthProvider not mounted');
};

const defaultState: AuthState = {
  mode: 'guest',
  displayName: 'Guest',
  deviceId: '',
  accountId: null,
  session: null,
  providers: { google: deriveGoogleProviderState(null) },
  signInModalOpen: false,
  openSignInModal: () => {},
  closeSignInModal: () => {},
  signOutConfirmOpen: false,
  openSignOutConfirm: () => {},
  closeSignOutConfirm: () => {},
  signInWithGoogle: defaultSignIn,
  signOut: defaultSignOut,
  refreshSession: async () => {},
};

const AuthContext = createContext<AuthState>(defaultState);

type SessionDerivedState = Pick<
  AuthState,
  'deviceId' | 'session' | 'mode' | 'accountId' | 'displayName'
>;

function deriveStateFromSession(args: {
  deviceId: string;
  sessionService: SessionService;
}): SessionDerivedState {
  const { deviceId, sessionService } = args;
  const session = sessionService.getSession();
  return {
    deviceId,
    session,
    mode:
      session !== null && sessionService.isAuthenticated()
        ? 'signed-in'
        : 'guest',
    accountId: session?.accountId ?? null,
    displayName: session !== null ? 'Signed in' : 'Guest',
  };
}

function useAuthSessionState(
  deviceId: string,
  sessionService: SessionService,
  secureStorage: SecureStorage
) {
  const [state, setState] = useState(() =>
    deriveStateFromSession({ deviceId, sessionService })
  );

  const refreshSession = useCallback(async () => {
    await sessionService.refresh();
    const session = sessionService.getSession();
    const store = getDefaultStore();
    if (Platform.OS !== 'web' && session === null) {
      const current = store.get(accountIdAtom);
      if (current !== null) {
        await writeLastLocalAccountId(secureStorage, null);
      }
    }
    store.set(accountIdAtom, session?.accountId ?? null);
    store.set(sessionTokenAtom, session?.token ?? null);
    setState(deriveStateFromSession({ deviceId, sessionService }));
  }, [deviceId, sessionService, secureStorage]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  return { state, refreshSession };
}

function useSubscribeToSessionChanges(args: {
  deviceId: string;
  refreshSession: () => Promise<void>;
}) {
  const { deviceId, refreshSession } = args;
  const { decorated: subDb } = usePatchDbStack();
  useEffect(() => {
    const unsub = subDb.subscribe.entities(
      {
        entityType: ACCOUNT_SESSION_ENTITY_TYPE,
        where: {
          type: '=',
          attribute: AccountSessionAttr.deviceId,
          value: deviceId,
        },
      },
      () => {
        void refreshSession();
      }
    );
    return unsub;
  }, [subDb, deviceId, refreshSession]);
}

type AuthModals = {
  signInModalOpen: boolean;
  openSignInModal: () => void;
  closeSignInModal: () => void;
  signOutConfirmOpen: boolean;
  openSignOutConfirm: () => void;
  closeSignOutConfirm: () => void;
};

function useAuthModals(): AuthModals {
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const openSignInModal = useCallback(() => setSignInModalOpen(true), []);
  const closeSignInModal = useCallback(() => setSignInModalOpen(false), []);

  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const openSignOutConfirm = useCallback(() => setSignOutConfirmOpen(true), []);
  const closeSignOutConfirm = useCallback(
    () => setSignOutConfirmOpen(false),
    []
  );

  return {
    signInModalOpen,
    openSignInModal,
    closeSignInModal,
    signOutConfirmOpen,
    openSignOutConfirm,
    closeSignOutConfirm,
  };
}

function useAuthActions(args: {
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
  return { signInWithGoogle, signOut };
}

function useConfirmSignOut(args: {
  signOut: () => Promise<void>;
  closeConfirm: () => void;
  log: ReturnType<typeof useLogger>;
}) {
  const { signOut, closeConfirm, log } = args;
  return useCallback(() => {
    closeConfirm();
    void (async () => {
      try {
        await signOut();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error('sign out failed', { error: message });
      }
    })();
  }, [signOut, closeConfirm, log]);
}

function useAuthStateValue(args: {
  state: SessionDerivedState;
  googleProvider: AuthGoogleProviderState;
  modals: AuthModals;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}): AuthState {
  const {
    state,
    googleProvider,
    modals,
    signInWithGoogle,
    signOut,
    refreshSession,
  } = args;
  return useMemo<AuthState>(
    () => ({
      ...state,
      providers: { google: googleProvider },
      ...modals,
      signInWithGoogle,
      signOut,
      refreshSession,
    }),
    [state, googleProvider, modals, signInWithGoogle, signOut, refreshSession]
  );
}

function AuthStateProvider({
  children,
  googleProvider,
  authService,
}: {
  children: ReactNode;
  googleProvider: AuthGoogleProviderState;
  authService: AuthService;
}) {
  const deviceService = useDeviceService();
  const sessionService = useSessionService();
  const secureStorage = useSecureStorage();
  const deviceId = deviceService.getDeviceId();
  const log = useLogger('auth-context');

  const { state, refreshSession } = useAuthSessionState(
    deviceId,
    sessionService,
    secureStorage
  );
  useSubscribeToSessionChanges({ deviceId, refreshSession });

  const modals = useAuthModals();
  const { signInWithGoogle, signOut } = useAuthActions({
    authService,
    refreshSession,
  });
  const handleConfirmSignOut = useConfirmSignOut({
    signOut,
    closeConfirm: modals.closeSignOutConfirm,
    log,
  });
  const value = useAuthStateValue({
    state,
    googleProvider,
    modals,
    signInWithGoogle,
    signOut,
    refreshSession,
  });

  return (
    <>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
      <SignInModal
        visible={modals.signInModalOpen}
        onClose={modals.closeSignInModal}
        google={googleProvider}
        onSignInWithGoogle={signInWithGoogle}
      />
      <ConfirmationModal
        visible={modals.signOutConfirmOpen}
        title={<Trans>Sign out?</Trans>}
        message={
          <Trans>You will need to sign in again to sync with your user.</Trans>
        }
        confirmLabel={<Trans>Sign out</Trans>}
        cancelLabel={<Trans>Cancel</Trans>}
        variant="destructive"
        onConfirm={handleConfirmSignOut}
        onCancel={modals.closeSignOutConfirm}
      />
    </>
  );
}

function AuthContainerBridgeInner({
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

  return (
    <AuthStateProvider
      googleProvider={googleProvider}
      authService={authService}
    >
      {children}
    </AuthStateProvider>
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
    <AuthContainerBridgeInner
      promptGoogleIdToken={promptGoogleIdToken}
      googleProvider={googleProvider}
    >
      {children}
    </AuthContainerBridgeInner>
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
    <AuthContainerBridgeInner
      promptGoogleIdToken={promptGoogleIdTokenUnreachable}
      googleProvider={googleProvider}
    >
      {children}
    </AuthContainerBridgeInner>
  );
}

function AuthContainerBridge({ children }: { children: ReactNode }) {
  const entity = useQueryOne({
    entityType: CLIENT_CONFIG_ENTITY_TYPE,
    entityId: CLIENT_CONFIG_ENTITY_ID,
  });

  const raw = entity?.attributes[ClientConfigAttr.googleWebClientId];
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  const googleWebClientId = trimmed.length > 0 ? trimmed : null;

  const googleProvider = useMemo(
    () => deriveGoogleProviderState(googleWebClientId),
    [googleWebClientId]
  );

  if (googleWebClientId !== null) {
    return (
      <AuthWithGoogleBridge
        googleWebClientId={googleWebClientId}
        googleProvider={googleProvider}
      >
        {children}
      </AuthWithGoogleBridge>
    );
  }

  return (
    <AuthStubGoogleBridge googleProvider={googleProvider}>
      {children}
    </AuthStubGoogleBridge>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContainerBridge>{children}</AuthContainerBridge>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
