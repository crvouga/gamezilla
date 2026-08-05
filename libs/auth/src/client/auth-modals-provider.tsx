import { useLogger } from '@pkgs/logger/react';
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'expo-router';

import { useSignOut } from './use-sign-out';
import { useSignOutConfirmationModal } from './use-sign-out-confirmation';
import { SignInModal, type SignInModalProps } from './sign-in-modal';
import { useSignIn } from './use-sign-in';
import { useSignInPending } from './sign-in-pending';
import { HOSTED_SIGN_IN_UNAVAILABLE_REASON } from './auth-errors';
import { useConfigService } from './config-service-context';

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
  const router = useRouter();

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
    signOut: async () => {
      await signOut();
      router.replace('/');
    },
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
  const signIn = useSignIn();
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

  const signInAvailable = apiUrl.trim().length > 0;
  const signInModalVisible = signInModalOpen || resumePending;
  return {
    visible: signInModalVisible,
    onClose: closeSignInModal,
    resumePending,
    signInAvailable,
    signInUnavailableReason: signInAvailable
      ? null
      : HOSTED_SIGN_IN_UNAVAILABLE_REASON,
    onSignInWithHosted: async () => {
      await signIn();
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
