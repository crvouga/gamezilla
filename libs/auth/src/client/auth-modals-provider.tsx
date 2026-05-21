import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useSignOut } from './use-sign-out';
import { useSignOutConfirmationModal } from './use-sign-out-confirmation';
import { SignInModal } from './sign-in-modal';
import { useSignIn } from './use-sign-in';
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
 * (`useCurrentUser`, `useSessionToken`, etc.) is intentionally not exposed
 * here — components read those hooks directly.
 */
export function AuthModalsProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const apiUrl = useConfigService().getApiUrl();
  const signIn = useSignIn();
  const signOut = useSignOut();

  const openSignInModal = useCallback(() => setSignInModalOpen(true), []);
  const closeSignInModal = useCallback(() => setSignInModalOpen(false), []);

  const {
    openSignOutConfirm,
    closeSignOutConfirm,
    modal: signOutModal,
  } = useSignOutConfirmationModal({
    signOut: () => signOut(),
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

  const signInAvailable = apiUrl.trim().length > 0;
  const signInUnavailableReason = signInAvailable
    ? null
    : HOSTED_SIGN_IN_UNAVAILABLE_REASON;

  return (
    <Ctx.Provider value={value}>
      <SignInModal
        visible={signInModalOpen}
        onClose={closeSignInModal}
        signInAvailable={signInAvailable}
        signInUnavailableReason={signInUnavailableReason}
        onSignInWithHosted={signIn}
      />
      {signOutModal}
      {children}
    </Ctx.Provider>
  );
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
