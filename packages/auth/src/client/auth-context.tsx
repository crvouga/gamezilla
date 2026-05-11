/* eslint-disable lingui/no-unlocalized-strings -- Better Auth / Expo wiring (not user-facing copy). */
import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  useDerivedSessionState,
  useHostedSessionSyncEffect,
  useHostedSyncRuntime,
  useSignOut,
  type AuthClient,
} from './auth-context-hooks';
import type { SessionDerivedState } from './auth-atoms';
import { HOSTED_SIGN_IN_UNAVAILABLE_REASON } from './auth-errors';
import { useConfigService } from './config-service-context';
import type { EnsureProfileFn } from './finalize-local-sign-in';
import { IdentityProvider } from './identity-context';
import { SignInModal } from './sign-in-modal';
import { useSignOutConfirmationModal } from './use-sign-out-confirmation';

export type AuthState = {
  deviceId: string;
  accountId: string | null;
  isAuthenticated: boolean;
  myId: string;
  session: SessionDerivedState['session'];
  signInAvailable: boolean;
  signInUnavailableReason: string | null;
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

const AuthCtx = createContext<AuthState | null>(null);

function authBaseUrl(apiUrl: string): string {
  const trimmed = apiUrl.trim();
  let origin =
    trimmed.length > 0 ? trimmed.replace(/\/$/, '') : 'http://127.0.0.1:8788';
  // Keep hosted auth on same-site host during local web dev to preserve
  // Better Auth state cookie across /sign-in -> /callback.
  if (
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost'
  ) {
    try {
      const u = new URL(origin);
      if (u.hostname === '127.0.0.1') {
        u.hostname = 'localhost';
        origin = u.origin;
      }
    } catch {
      /* keep origin when URL parsing fails */
    }
  }
  return `${origin}/api/auth`;
}

function resolveCallbackUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/sso-callback`;
  }
  return '/sso-callback';
}

type SignInSocialResult = {
  error?: { message?: string } | null;
  data?: { url?: string; redirect?: boolean } | null;
};

function navigateIfRedirectUrl(res: SignInSocialResult): void {
  const url = res.data?.url;
  if (typeof url !== 'string' || url.length === 0) return;
  if (typeof window === 'undefined') return;
  if (window.location.href === url) return;
  window.location.href = url;
}

function useAuthClient(baseURL: string): AuthClient {
  return useMemo(
    () =>
      createAuthClient({
        baseURL,
        plugins: [
          expoClient({
            scheme: 'myapp',
            storagePrefix: 'gamezilla',
            storage: SecureStore,
          }),
        ],
      }),
    [baseURL]
  );
}

function useSignInAction(args: {
  authClient: AuthClient;
  refreshSession: () => Promise<void>;
}): () => Promise<void> {
  const { authClient, refreshSession } = args;
  return useCallback(async () => {
    const callbackURL = resolveCallbackUrl();
    const res = (await authClient.signIn.social({
      provider: 'google',
      callbackURL,
    })) as SignInSocialResult;
    if (res.error !== undefined && res.error !== null) {
      throw new Error(res.error.message ?? 'Hosted sign-in failed');
    }
    navigateIfRedirectUrl(res);
    await refreshSession();
  }, [authClient, refreshSession]);
}

type ModalState = {
  signInModalOpen: boolean;
  openSignInModal: () => void;
  closeSignInModal: () => void;
  signOutConfirmOpen: boolean;
  openSignOutConfirm: () => void;
  closeSignOutConfirm: () => void;
  signOutModal: ReactNode;
};

function useModalState(signOut: () => Promise<void>): ModalState {
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);

  const openSignInModal = useCallback(() => setSignInModalOpen(true), []);
  const closeSignInModal = useCallback(() => setSignInModalOpen(false), []);

  const { openSignOutConfirm, closeSignOutConfirm, modal } =
    useSignOutConfirmationModal({
      signOut: () => signOut(),
      signOutConfirmOpen,
      openSignOutConfirmBase: () => setSignOutConfirmOpen(true),
      closeSignOutConfirmBase: () => setSignOutConfirmOpen(false),
    });

  return {
    signInModalOpen,
    openSignInModal,
    closeSignInModal,
    signOutConfirmOpen,
    openSignOutConfirm,
    closeSignOutConfirm,
    signOutModal: modal,
  };
}

function buildAuthValue(args: {
  derived: SessionDerivedState;
  signInAvailable: boolean;
  signInUnavailableReason: string | null;
  modals: ModalState;
  signInWithHosted: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}): AuthState {
  const { derived, modals } = args;
  return {
    deviceId: derived.deviceId,
    accountId: derived.accountId,
    isAuthenticated: derived.isAuthenticated,
    myId: derived.myId,
    session: derived.session,
    signInAvailable: args.signInAvailable,
    signInUnavailableReason: args.signInUnavailableReason,
    signInModalOpen: modals.signInModalOpen,
    openSignInModal: modals.openSignInModal,
    closeSignInModal: modals.closeSignInModal,
    signOutConfirmOpen: modals.signOutConfirmOpen,
    openSignOutConfirm: modals.openSignOutConfirm,
    closeSignOutConfirm: modals.closeSignOutConfirm,
    signInWithHosted: args.signInWithHosted,
    signOut: args.signOut,
    refreshSession: args.refreshSession,
  };
}

function AuthRender(props: {
  value: AuthState;
  modals: ModalState;
  signInAvailable: boolean;
  signInUnavailableReason: string | null;
  signInWithHosted: () => Promise<void>;
  identity: { deviceId: string; accountId: string | null; myId: string };
  children: ReactNode;
}): ReactNode {
  const { value, modals, identity, children } = props;
  return (
    <AuthCtx.Provider value={value}>
      <SignInModal
        visible={modals.signInModalOpen}
        onClose={modals.closeSignInModal}
        signInAvailable={props.signInAvailable}
        signInUnavailableReason={props.signInUnavailableReason}
        onSignInWithHosted={() => props.signInWithHosted()}
      />
      {modals.signOutModal}
      <IdentityProvider value={identity}>{children}</IdentityProvider>
    </AuthCtx.Provider>
  );
}

export function AuthProvider({
  children,
  ensureProfile,
}: {
  children: ReactNode;
  ensureProfile: EnsureProfileFn;
}): ReactNode {
  const apiUrl = useConfigService().getApiUrl();
  const authClient = useAuthClient(
    useMemo(() => authBaseUrl(apiUrl), [apiUrl])
  );
  const snapshot = authClient.useSession();
  const syncRuntime = useHostedSyncRuntime();
  useHostedSessionSyncEffect({
    authClient,
    snapshot,
    ensureProfile,
    syncRuntime,
  });

  const { derived, pushDerived } = useDerivedSessionState();
  const refreshSession = useCallback(() => pushDerived(), [pushDerived]);
  const signInWithHosted = useSignInAction({ authClient, refreshSession });
  const signOut = useSignOut(authClient, syncRuntime, refreshSession);
  const modals = useModalState(signOut);

  const signInAvailable = apiUrl.trim().length > 0;
  const signInUnavailableReason = signInAvailable
    ? null
    : HOSTED_SIGN_IN_UNAVAILABLE_REASON;

  const identity = useMemo(
    () => ({
      deviceId: derived.deviceId,
      accountId: derived.accountId,
      myId: derived.myId,
    }),
    [derived.deviceId, derived.accountId, derived.myId]
  );

  const value = useMemo<AuthState>(
    () =>
      buildAuthValue({
        derived,
        signInAvailable,
        signInUnavailableReason,
        modals,
        signInWithHosted,
        signOut,
        refreshSession,
      }),
    [
      derived,
      signInAvailable,
      signInUnavailableReason,
      modals,
      signInWithHosted,
      signOut,
      refreshSession,
    ]
  );

  return (
    <AuthRender
      value={value}
      modals={modals}
      signInAvailable={signInAvailable}
      signInUnavailableReason={signInUnavailableReason}
      signInWithHosted={signInWithHosted}
      identity={identity}
    >
      {children}
    </AuthRender>
  );
}

export function useAuth(): AuthState {
  const v = useContext(AuthCtx);
  if (v === null) {
    throw new Error('useAuth: missing AuthProvider');
  }
  return v;
}

export { useMyId } from './identity-context';
