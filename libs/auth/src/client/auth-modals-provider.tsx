import { useLogger } from '@pkgs/logger/react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  HOSTED_SIGN_IN_UNAVAILABLE_REASON,
  NO_SIGN_IN_METHODS_REASON,
} from './auth-errors';
import { useConfigService } from './config-service-context';
import { useSignInCapabilities } from './sign-in-capabilities-context';
import { SignInModal, type SignInModalProps } from './sign-in-modal';
import { useSignInPending } from './sign-in-pending';
import { useSignIn } from './use-sign-in';
import { useSignOut } from './use-sign-out';
import { useSignOutConfirmationModal } from './use-sign-out-confirmation';

export type AuthModals = {
  signInModalOpen: boolean;
  openSignInModal: () => void;
  closeSignInModal: () => void;
  signOutConfirmOpen: boolean;
  openSignOutConfirm: () => void;
  closeSignOutConfirm: () => void;
};

const Ctx = createContext<AuthModals | null>(null);

/**
 * Owns just the open/close state for the sign-in modal and the sign-out
 * confirmation modal, plus mounts the modals themselves. Auth state
 * (`useCurrentUser`, `useFreshAuthToken`, etc.) is intentionally not exposed
 * here — components read those hooks directly.
 */
export function AuthModalsProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const signOut = useSignOut();

  const openSignInModal = useCallback(() => setSignInModalOpen(true), []);
  const closeSignInModal = useCallback(() => setSignInModalOpen(false), []);
  const signInModalProps = useSignInModalConnection({
    signInModalOpen,
    openSignInModal,
    closeSignInModal,
  });

  const {
    openSignOutConfirm,
    closeSignOutConfirm,
    modal: signOutModal,
  } = useSignOutConfirmationModal({
    // Stay on the current screen — UI reacts to signed-out state.
    signOut,
    signOutConfirmOpen,
    openSignOutConfirmBase: () => setSignOutConfirmOpen(true),
    closeSignOutConfirmBase: () => setSignOutConfirmOpen(false),
  });

  const value = useMemo<AuthModals>(
    () => ({
      signInModalOpen,
      openSignInModal,
      closeSignInModal,
      signOutConfirmOpen,
      openSignOutConfirm,
      closeSignOutConfirm,
    }),
    [
      signInModalOpen,
      openSignInModal,
      closeSignInModal,
      signOutConfirmOpen,
      openSignOutConfirm,
      closeSignOutConfirm,
    ]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <SignInModal {...signInModalProps} />
      {signOutModal}
    </Ctx.Provider>
  );
}

/**
 * Derives the {@link SignInModal} props from config + the durable pending
 * marker, and auto-opens the modal (into its loading state) when a sign-in was
 * in flight before an OAuth redirect unloaded the page.
 */
function useSignInModalConnection(args: {
  signInModalOpen: boolean;
  openSignInModal: () => void;
  closeSignInModal: () => void;
}): SignInModalProps {
  const { signInModalOpen, openSignInModal, closeSignInModal } = args;
  const apiUrl = useConfigService().getApiUrl();
  const { signInWithGoogle, signInWithEmail } = useSignIn();
  const capabilities = useSignInCapabilities();
  const signInLog = useLogger('auth-sign-in');
  const { pending, isHydrated } = useSignInPending();
  const resumePending = isHydrated && pending !== null;

  useLayoutEffect(() => {
    if (resumePending) openSignInModal();
  }, [resumePending, openSignInModal]);

  const onError = useCallback(
    (err: Error) => {
      signInLog.error('sign in failed', { error: err.message });
    },
    [signInLog]
  );

  const apiReachable = apiUrl.trim().length > 0;
  const googleAvailable = apiReachable && capabilities.google;
  const emailPasswordAvailable = apiReachable && capabilities.emailPassword;
  const anyMethod = googleAvailable || emailPasswordAvailable;
  const signInModalVisible = signInModalOpen || resumePending;
  const signInUnavailableReason = anyMethod
    ? null
    : apiReachable
      ? NO_SIGN_IN_METHODS_REASON
      : HOSTED_SIGN_IN_UNAVAILABLE_REASON;
  return {
    visible: signInModalVisible,
    onClose: closeSignInModal,
    resumePending,
    googleAvailable,
    emailPasswordAvailable,
    signInUnavailableReason,
    onSignInWithGoogle: async () => {
      await signInWithGoogle();
    },
    onSignInWithEmail: async (credentials) => {
      await signInWithEmail(credentials);
    },
    onError,
  };
}

export function useAuthModals(): AuthModals {
  const v = useContext(Ctx);
  if (v === null) {
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
  isOpen: boolean;
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
  isOpen: boolean;
} {
  const m = useAuthModals();
  return {
    open: m.openSignOutConfirm,
    close: m.closeSignOutConfirm,
    isOpen: m.signOutConfirmOpen,
  };
}
