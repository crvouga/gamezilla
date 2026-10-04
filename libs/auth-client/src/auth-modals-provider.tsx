import {
  HOSTED_SIGN_IN_UNAVAILABLE_REASON,
  NO_SIGN_IN_METHODS_REASON,
} from '@libs/auth-shared/auth-errors';
import type { SignInOptions } from '@pkgs/auth-root-shared/auth-client-port';
import type { OauthProviderId } from '@pkgs/auth-root-shared/sign-in-method';
import { useLogger } from '@pkgs/logger-client/solid';
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  useContext,
} from 'solid-js';
import { useConfigService } from './config-service-context';
import { useSignInCapabilities } from './sign-in-capabilities-context';
import { SignInModal } from './sign-in-modal';
import { useSignInPending } from './sign-in-pending';
import { useSignIn } from './use-sign-in';
import { useSignOut } from './use-sign-out';
import { useSignOutConfirmationModal } from './use-sign-out-confirmation';

export type AuthModals = {
  signInModalOpen: Accessor<boolean>;
  openSignInModal: () => void;
  closeSignInModal: () => void;
  signOutConfirmOpen: Accessor<boolean>;
  openSignOutConfirm: () => void;
  closeSignOutConfirm: () => void;
};

const Ctx = createContext<AuthModals>();

/**
 * Owns just the open/close state for the sign-in modal and the sign-out
 * confirmation modal, plus mounts the modals themselves. Auth state
 * (`useCurrentUser`, `useFreshAuthToken`, etc.) is intentionally not exposed
 * here — components read those hooks directly.
 */
export function AuthModalsProvider(props: {
  children: JSX.Element;
}): JSX.Element {
  const [signInModalOpen, setSignInModalOpen] = createSignal(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = createSignal(false);
  const signOut = useSignOut();

  const openSignInModal = () => setSignInModalOpen(true);
  const closeSignInModal = () => setSignInModalOpen(false);
  const connection = useSignInModalConnection({
    signInModalOpen,
    openSignInModal,
    closeSignInModal,
  });

  const signOutConfirm = useSignOutConfirmationModal({
    // Stay on the current screen — UI reacts to signed-out state.
    signOut,
    signOutConfirmOpen,
    openSignOutConfirmBase: () => setSignOutConfirmOpen(true),
    closeSignOutConfirmBase: () => setSignOutConfirmOpen(false),
  });

  const value: AuthModals = {
    signInModalOpen,
    openSignInModal,
    closeSignInModal,
    signOutConfirmOpen,
    openSignOutConfirm: signOutConfirm.openSignOutConfirm,
    closeSignOutConfirm: signOutConfirm.closeSignOutConfirm,
  };

  return (
    <Ctx.Provider value={value}>
      {props.children}
      <SignInModal
        visible={connection.visible()}
        onClose={connection.onClose}
        resumePending={connection.resumePending()}
        methodsLoading={connection.methodsLoading()}
        providers={connection.providers()}
        signInUnavailableReason={connection.signInUnavailableReason()}
        onSignIn={connection.onSignIn}
        onCreateSeparate={connection.onCreateSeparate}
        onError={connection.onError}
      />
      {signOutConfirm.modal}
    </Ctx.Provider>
  );
}

/**
 * Derives the {@link SignInModal} props from config + the durable pending
 * marker, and auto-opens the modal (into its loading state) when a sign-in was
 * in flight before an OAuth redirect unloaded the page.
 */
function useSignInModalConnection(args: {
  signInModalOpen: Accessor<boolean>;
  openSignInModal: () => void;
  closeSignInModal: () => void;
}) {
  const apiUrl = useConfigService().getApiUrl();
  const { signInWith, createSeparateAccount } = useSignIn();
  const capabilities = useSignInCapabilities();
  const signInLog = useLogger('auth-sign-in');
  const { pending, isHydrated } = useSignInPending();
  const resumePending = createMemo(() => isHydrated() && pending() !== null);

  createEffect(
    on(
      resumePending,
      (value) => {
        if (value) args.openSignInModal();
      },
      { defer: true }
    )
  );

  const onError = (err: Error) => {
    signInLog.error('sign in failed', { error: err.message });
  };

  const apiReachable = apiUrl.trim().length > 0;
  const methodsLoading = createMemo(() => !capabilities.ready);
  const providers = createMemo<readonly OauthProviderId[]>(() => {
    if (methodsLoading() || !apiReachable) return [];
    return [
      ...(capabilities.google ? (['google'] as const) : []),
      ...(capabilities.apple ? (['apple'] as const) : []),
    ];
  });
  const anyMethod = createMemo(() => providers().length > 0);
  const visible = createMemo(() => args.signInModalOpen() || resumePending());
  const signInUnavailableReason = createMemo<string | null>(() =>
    methodsLoading() || anyMethod()
      ? null
      : apiReachable
        ? NO_SIGN_IN_METHODS_REASON
        : HOSTED_SIGN_IN_UNAVAILABLE_REASON
  );
  return {
    visible,
    onClose: args.closeSignInModal,
    resumePending,
    methodsLoading,
    providers,
    signInUnavailableReason,
    onSignIn: async (provider: OauthProviderId, options?: SignInOptions) => {
      await signInWith(provider, options);
    },
    onCreateSeparate: async (token: string) => {
      await createSeparateAccount(token);
    },
    onError,
  };
}

export function useAuthModals(): AuthModals {
  const v = useContext(Ctx);
  if (v === undefined) {
    throw new Error(
      'useAuthModals: AuthModalsProvider missing — wrap with AppProviders'
    );
  }
  return v;
}

/**
 * Convenience hook for sign-in trigger UI: returns `{ open, close }`.
 */
export function useSignInModal(): {
  open: () => void;
  close: () => void;
  isOpen: Accessor<boolean>;
} {
  const m = useAuthModals();
  return {
    open: m.openSignInModal,
    close: m.closeSignInModal,
    isOpen: m.signInModalOpen,
  };
}

/** Convenience hook for sign-out trigger UI. */
export function useSignOutModal(): {
  open: () => void;
  close: () => void;
  isOpen: Accessor<boolean>;
} {
  const m = useAuthModals();
  return {
    open: m.openSignOutConfirm,
    close: m.closeSignOutConfirm,
    isOpen: m.signOutConfirmOpen,
  };
}
