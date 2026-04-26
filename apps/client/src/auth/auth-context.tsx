import {
  CLIENT_CONFIG_ENTITY_ID,
  CLIENT_CONFIG_ENTITY_TYPE,
  ClientConfigAttr,
  PRINCIPAL_SESSION_ENTITY_TYPE,
  PrincipalSessionAttr,
} from '@gamezilla/domain/auth';
import { assert } from '@gamezilla/lib/assert';
import { ConfigServiceToken } from '@gamezilla/domain/config/config-service';
import { DependencyInjectionContainer } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import {
  ContainerProvider,
  useContainer,
  useDependency,
} from '@gamezilla/lib/dependency-injection/react';
import { PatchesDbToken, useEntity } from '@gamezilla/patch-db/react';
import { SubscribablePatchesDbToken } from '@gamezilla/patch-db/subscribable';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthGoogleProviderState } from './auth-capabilities';
import { deriveGoogleProviderState } from './auth-capabilities';
import { AuthServiceToken, createAuthService } from './auth-service';
import { PrincipalServiceToken } from './principal-service';
import {
  SessionServiceToken,
  type PrincipalSessionRecord,
  type SessionService,
} from './session-service';
import { SignInModal } from './sign-in-modal';
import { useGoogleIdTokenPrompt } from './use-google-id-token-prompt';

export type AuthState = {
  mode: 'guest' | 'signed-in';
  displayName: string;
  principalId: string;
  accountId: string | null;
  session: PrincipalSessionRecord | null;
  /** Google OAuth availability from synced client config. */
  providers: { google: AuthGoogleProviderState };
  signInModalOpen: boolean;
  openSignInModal: () => void;
  closeSignInModal: () => void;
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
  principalId: '',
  accountId: null,
  session: null,
  providers: { google: deriveGoogleProviderState(null) },
  signInModalOpen: false,
  openSignInModal: () => {},
  closeSignInModal: () => {},
  signInWithGoogle: defaultSignIn,
  signOut: defaultSignOut,
  refreshSession: async () => {},
};

const AuthContext = createContext<AuthState>(defaultState);

type SessionDerivedState = Pick<
  AuthState,
  | 'principalId'
  | 'session'
  | 'mode'
  | 'accountId'
  | 'displayName'
>;

function deriveStateFromSession(args: {
  principalId: string;
  sessionService: SessionService;
}): SessionDerivedState {
  const { principalId, sessionService } = args;
  const session = sessionService.getSession();
  return {
    principalId,
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
  principalId: string,
  sessionService: SessionService
) {
  const [state, setState] = useState(() =>
    deriveStateFromSession({ principalId, sessionService })
  );

  const refreshSession = useCallback(async () => {
    await sessionService.refresh();
    setState(deriveStateFromSession({ principalId, sessionService }));
  }, [principalId, sessionService]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  return { state, refreshSession };
}

function useSubscribeToSessionChanges(args: {
  principalId: string;
  refreshSession: () => Promise<void>;
}) {
  const { principalId, refreshSession } = args;
  const subDb = useDependency(SubscribablePatchesDbToken);
  useEffect(() => {
    const unsub = subDb.subscribe.entities(
      {
        entityType: PRINCIPAL_SESSION_ENTITY_TYPE,
        where: {
          type: '=',
          attribute: PrincipalSessionAttr.principalId,
          value: principalId,
        },
      },
      () => {
        void refreshSession();
      }
    );
    return unsub;
  }, [subDb, principalId, refreshSession]);
}

function AuthStateProvider({
  children,
  googleProvider,
}: {
  children: ReactNode;
  googleProvider: AuthGoogleProviderState;
}) {
  const authService = useDependency(AuthServiceToken);
  const principalService = useDependency(PrincipalServiceToken);
  const sessionService = useDependency(SessionServiceToken);
  const principalId = principalService.getPrincipalId();

  const { state, refreshSession } = useAuthSessionState(
    principalId,
    sessionService
  );
  useSubscribeToSessionChanges({ principalId, refreshSession });

  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const openSignInModal = useCallback(() => {
    setSignInModalOpen(true);
  }, []);
  const closeSignInModal = useCallback(() => {
    setSignInModalOpen(false);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await authService.signInWithGoogle();
    await refreshSession();
  }, [authService, refreshSession]);

  const signOut = useCallback(async () => {
    await authService.signOut();
    await refreshSession();
  }, [authService, refreshSession]);

  const handleModalGoogleSignIn = useCallback(async () => {
    await authService.signInWithGoogle();
    await refreshSession();
  }, [authService, refreshSession]);

  const value = useMemo<AuthState>(
    () => ({
      ...state,
      providers: { google: googleProvider },
      signInModalOpen,
      openSignInModal,
      closeSignInModal,
      signInWithGoogle,
      signOut,
      refreshSession,
    }),
    [
      state,
      googleProvider,
      signInModalOpen,
      openSignInModal,
      closeSignInModal,
      signInWithGoogle,
      signOut,
      refreshSession,
    ]
  );

  return (
    <>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
      <SignInModal
        visible={signInModalOpen}
        onClose={closeSignInModal}
        google={googleProvider}
        onSignInWithGoogle={handleModalGoogleSignIn}
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
  const parentContainer = useContainer();
  assert.ok(
    parentContainer instanceof DependencyInjectionContainer,
    'AuthProvider must be under DI'
  );
  const configService = useDependency(ConfigServiceToken);
  const principalService = useDependency(PrincipalServiceToken);
  const db = useDependency(PatchesDbToken);
  const sessionService = useDependency(SessionServiceToken);

  const authContainer = useMemo(() => {
    const child = new DependencyInjectionContainer(parentContainer);
    child.registerValue(
      AuthServiceToken,
      createAuthService({
        configService,
        principalService,
        db,
        sessionService,
        googleSignInAvailable: googleProvider.available,
        promptGoogleIdToken,
      })
    );
    return child;
  }, [
    parentContainer,
    configService,
    principalService,
    db,
    sessionService,
    googleProvider.available,
    promptGoogleIdToken,
  ]);

  return (
    <ContainerProvider container={authContainer}>
      <AuthStateProvider googleProvider={googleProvider}>
        {children}
      </AuthStateProvider>
    </ContainerProvider>
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
  const promptGoogleIdTokenUnreachable = useCallback(async (): Promise<string> => {
    throw new Error('Google sign-in prompt should not run when Google is unavailable');
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
  const entity = useEntity({
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
