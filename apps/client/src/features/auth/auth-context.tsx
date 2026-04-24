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
import { AuthServiceToken, createAuthService } from './auth-service';
import { PrincipalServiceToken } from './principal-service';
import {
  SessionServiceToken,
  type PrincipalSessionRecord,
} from './session-service';
import { useGoogleIdTokenPrompt } from './use-google-id-token-prompt';

export type AuthState = {
  mode: 'guest' | 'signed-in';
  displayName: string;
  principalId: string;
  accountId: string | null;
  session: PrincipalSessionRecord | null;
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
  signInWithGoogle: defaultSignIn,
  signOut: defaultSignOut,
  refreshSession: async () => {},
};

const AuthContext = createContext<AuthState>(defaultState);

function AuthStateProvider({ children }: { children: ReactNode }) {
  const authService = useDependency(AuthServiceToken);
  const principalService = useDependency(PrincipalServiceToken);
  const sessionService = useDependency(SessionServiceToken);
  const subDb = useDependency(SubscribablePatchesDbToken);

  const principalId = principalService.getPrincipalId();

  const [state, setState] = useState<Omit<AuthState, 'signInWithGoogle' | 'signOut' | 'refreshSession'>>(() => {
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
  });

  const refreshSession = useCallback(async () => {
    await sessionService.refresh();
    const session = sessionService.getSession();
    const mode =
      session !== null && sessionService.isAuthenticated()
        ? 'signed-in'
        : 'guest';
    setState({
      principalId,
      session,
      mode,
      accountId: session?.accountId ?? null,
      displayName: session !== null ? 'Signed in' : 'Guest',
    });
  }, [principalId, sessionService]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

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

  const signInWithGoogle = useCallback(async () => {
    await authService.signInWithGoogle();
    await refreshSession();
  }, [authService, refreshSession]);

  const signOut = useCallback(async () => {
    await authService.signOut();
    await refreshSession();
  }, [authService, refreshSession]);

  const value = useMemo<AuthState>(
    () => ({
      ...state,
      signInWithGoogle,
      signOut,
      refreshSession,
    }),
    [state, signInWithGoogle, signOut, refreshSession]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

function AuthContainerBridgeInner({
  children,
  promptGoogleIdToken,
}: {
  children: ReactNode;
  promptGoogleIdToken: () => Promise<string>;
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
    promptGoogleIdToken,
  ]);

  return (
    <ContainerProvider container={authContainer}>
      <AuthStateProvider>{children}</AuthStateProvider>
    </ContainerProvider>
  );
}

function AuthWithGoogleBridge({
  children,
  googleWebClientId,
}: {
  children: ReactNode;
  googleWebClientId: string;
}) {
  const promptGoogleIdToken = useGoogleIdTokenPrompt(googleWebClientId);
  return (
    <AuthContainerBridgeInner promptGoogleIdToken={promptGoogleIdToken}>
      {children}
    </AuthContainerBridgeInner>
  );
}

function AuthStubGoogleBridge({ children }: { children: ReactNode }) {
  const promptGoogleIdTokenUnavailable = useCallback(
    async (): Promise<string> => {
      throw new Error(
        'Google sign-in is not configured on this server (missing GOOGLE_CLIENT_ID)'
      );
    },
    []
  );

  return (
    <AuthContainerBridgeInner
      promptGoogleIdToken={promptGoogleIdTokenUnavailable}
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
  const googleWebClientId =
    typeof raw === 'string' && raw.length > 0 ? raw : null;

  if (googleWebClientId !== null) {
    return (
      <AuthWithGoogleBridge googleWebClientId={googleWebClientId}>
        {children}
      </AuthWithGoogleBridge>
    );
  }

  return <AuthStubGoogleBridge>{children}</AuthStubGoogleBridge>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContainerBridge>{children}</AuthContainerBridge>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
