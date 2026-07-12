import {
  useSignInModal,
  useSignOutModal,
} from '@libs/auth/client/auth-modals-provider';
import { useIsSignedIn } from '@libs/auth/client/use-current-user';
import { MyDisplayName } from '@libs/profile/client/my-display-name';
import { useAsync } from '@pkgs/async/use-async';
import { useLogger } from '@pkgs/logger/react';
import type { LocalizedString } from '@pkgs/i18n';
import {
  LogInIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
  type FloatingMenuContent,
} from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

type AccountMenuLabels = {
  account: LocalizedString;
  settings: LocalizedString;
  signIn: LocalizedString;
  signOut: LocalizedString;
  userMenu: LocalizedString;
};

function useAccountMenuLabels(): AccountMenuLabels {
  const { t } = useLingui();
  return useMemo(
    () => ({
      account: t`Account`,
      settings: t`Settings`,
      signIn: t`Sign in`,
      signOut: t`Sign out`,
      userMenu: t`User menu`,
    }),
    [t]
  );
}

function useAccountMenuHandlers(close: () => void) {
  const isAuthenticated = useIsSignedIn();
  const { open: openSignInModal } = useSignInModal();
  const { open: openSignOutConfirm } = useSignOutModal();
  const router = useRouter();
  const log = useLogger('account-menu');

  const onAccount = useCallback(() => {
    close();
    router.push('/more/account');
  }, [close, router]);

  const onSettings = useCallback(() => {
    close();
    router.push('/more');
  }, [close, router]);

  const { run: runAuth } = useAsync({
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

  const onAuth = useCallback(() => {
    close();
    void runAuth().catch(() => {});
  }, [close, runAuth]);

  return { isAuthenticated, onAccount, onSettings, onAuth };
}

export function useAccountMenuContent(close: () => void): FloatingMenuContent {
  const labels = useAccountMenuLabels();
  const { isAuthenticated, onAccount, onSettings, onAuth } =
    useAccountMenuHandlers(close);

  return useMemo(
    (): FloatingMenuContent => ({
      header: { title: <MyDisplayName variant="bodyBold" /> },
      rows: [
        {
          type: 'item',
          id: 'account',
          label: labels.account,
          icon: UserIcon,
          onPress: onAccount,
          accessibilityLabel: labels.account,
        },
        {
          type: 'item',
          id: 'settings',
          label: labels.settings,
          icon: SettingsIcon,
          onPress: onSettings,
          accessibilityLabel: labels.settings,
        },
        { type: 'divider', id: 'before-auth' },
        {
          type: 'item',
          id: 'sign-in',
          label: isAuthenticated ? labels.signOut : labels.signIn,
          icon: isAuthenticated ? LogOutIcon : LogInIcon,
          onPress: onAuth,
          accessibilityLabel: isAuthenticated ? labels.signOut : labels.signIn,
        },
      ],
    }),
    [isAuthenticated, labels, onAccount, onAuth, onSettings]
  );
}

export function useAccountMenuTriggerLabel(): LocalizedString {
  const { t } = useLingui();
  return t`User menu`;
}
