import { useSignInModal } from '@libs/auth/client/auth-modals-provider';
import { useIsSignedIn } from '@libs/auth/client/use-current-user';
import { MyUsername } from '@libs/profile/client/my-username';
import { MyProfileAvatar } from '@libs/profile/client/my-profile-avatar';
import type { LocalizedString } from '@pkgs/i18n';
import {
  LogInIcon,
  SettingsIcon,
  UserIcon,
  iconButtonAvatarContentSize,
  type ActionBarItem,
  type FloatingMenuHeaderSpec,
} from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

const TRIGGER_SIZE = 36;

type AccountMenuLabels = {
  account: LocalizedString;
  settings: LocalizedString;
  signIn: LocalizedString;
  userMenu: LocalizedString;
};

function useAccountMenuLabels(): AccountMenuLabels {
  const { t } = useLingui();
  return useMemo(
    () => ({
      account: t`Account`,
      settings: t`Settings`,
      signIn: t`Sign in`,
      userMenu: t`User menu`,
    }),
    [t]
  );
}

function useAccountMenuHandlers() {
  const isAuthenticated = useIsSignedIn();
  const { open: openSignInModal } = useSignInModal();
  const router = useRouter();

  const onAccount = useCallback(() => {
    router.push('/more/account');
  }, [router]);

  const onSettings = useCallback(() => {
    router.push('/more');
  }, [router]);

  const onSignIn = useCallback(() => {
    openSignInModal();
  }, [openSignInModal]);

  return { isAuthenticated, onAccount, onSettings, onSignIn };
}

export function useAccountMenuItems(): ActionBarItem[] {
  const labels = useAccountMenuLabels();
  const { isAuthenticated, onAccount, onSettings, onSignIn } =
    useAccountMenuHandlers();

  return useMemo((): ActionBarItem[] => {
    const items: ActionBarItem[] = [
      {
        id: 'account',
        label: labels.account,
        icon: UserIcon,
        onPress: onAccount,
        overflow: 'always',
      },
      {
        id: 'settings',
        label: labels.settings,
        icon: SettingsIcon,
        onPress: onSettings,
        overflow: 'always',
      },
    ];

    if (!isAuthenticated) {
      items.push({
        id: 'sign-in',
        label: labels.signIn,
        icon: LogInIcon,
        onPress: onSignIn,
        overflow: 'always',
      });
    }

    return items;
  }, [isAuthenticated, labels, onAccount, onSettings, onSignIn]);
}

export function useAccountMenuHeader(): FloatingMenuHeaderSpec {
  const avatarSize = iconButtonAvatarContentSize(TRIGGER_SIZE);
  return useMemo(
    (): FloatingMenuHeaderSpec => ({
      avatar: <MyProfileAvatar size={avatarSize} />,
      title: <MyUsername variant="bodyBold" />,
    }),
    [avatarSize]
  );
}

export function useAccountMenuTriggerLabel(): LocalizedString {
  const { t } = useLingui();
  return t`User menu`;
}

export { TRIGGER_SIZE as ACCOUNT_MENU_TRIGGER_SIZE };
