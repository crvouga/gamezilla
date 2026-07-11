import {
  useSignInModal,
  useSignOutModal,
} from '@libs/auth/client/auth-modals-provider';
import { useIsSignedIn } from '@libs/auth/client/use-current-user';
import { useLogger } from '@pkgs/logger/react';
import { useAsync } from '@pkgs/async/use-async';
import {
  type ScreenBaseAction,
  LogInIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

function useAccountNav() {
  const router = useRouter();
  const onAccount = useCallback(() => {
    router.push('/more/account');
  }, [router]);
  const onSettings = useCallback(() => {
    router.push('/more');
  }, [router]);
  return { onAccount, onSettings };
}

function useAuthAction(
  isAuthenticated: boolean,
  openSignOutConfirm: () => void,
  openSignInModal: () => void
) {
  const log = useLogger('use-account-actions');
  const { run } = useAsync({
    operation: async () => {
      if (isAuthenticated) {
        openSignOutConfirm();
      } else {
        openSignInModal();
      }
    },
    options: {
      onError: (err) => {
        log.error('auth action failed', { error: err.message });
      },
    },
  });
  return useCallback(async () => {
    try {
      await run();
    } catch {
      // onError already logged via hook.
    }
  }, [run]);
}

type Labels = {
  account: string;
  settings: string;
  signIn: string;
  signOut: string;
};

function buildAuthAction(
  labels: Labels,
  isAuthenticated: boolean,
  onAuth: () => Promise<void>
): ScreenBaseAction {
  return {
    type: 'default',
    label: isAuthenticated ? labels.signOut : labels.signIn,
    icon: isAuthenticated ? LogOutIcon : LogInIcon,
    overflow: 'always',
    onPress: () => {
      void onAuth();
    },
    endsGroup: true,
  };
}

function buildActions(args: {
  labels: Labels;
  isAuthenticated: boolean;
  onAccount: () => void;
  onSettings: () => void;
  onAuth: () => Promise<void>;
}): ScreenBaseAction[] {
  const { labels, isAuthenticated, onAccount, onSettings, onAuth } = args;
  return [
    {
      type: 'default',
      label: labels.account,
      onPress: onAccount,
      icon: UserIcon,
      overflow: 'always',
    },
    {
      type: 'default',
      label: labels.settings,
      onPress: onSettings,
      icon: SettingsIcon,
      overflow: 'always',
    },
    buildAuthAction(labels, isAuthenticated, onAuth),
  ];
}

/**
 * Header overflow actions for account / settings / sign in or out.
 * Tab roots should pass these only on mobile (`useBreakpoint() === 'mobile'`).
 */
export function useAccountActions(): ScreenBaseAction[] {
  const { t } = useLingui();
  const isAuthenticated = useIsSignedIn();
  const { open: openSignInModal } = useSignInModal();
  const { open: openSignOutConfirm } = useSignOutModal();
  const { onAccount, onSettings } = useAccountNav();
  const onAuth = useAuthAction(
    isAuthenticated,
    openSignOutConfirm,
    openSignInModal
  );

  const labels = useMemo<Labels>(
    () => ({
      account: t`Account`,
      settings: t`Settings`,
      signIn: t`Sign in`,
      signOut: t`Sign out`,
    }),
    [t]
  );

  return useMemo(
    () =>
      buildActions({
        labels,
        isAuthenticated,
        onAccount,
        onSettings,
        onAuth,
      }),
    [labels, isAuthenticated, onAccount, onSettings, onAuth]
  );
}
