/**
 * Compact account menu items for tab-root headers. Menu items only — no header
 * and no inline account switcher (switching lives on /more/account/switch).
 */

import {
  useSignInModal,
  useSignOutModal,
} from '@libs/auth/client/auth-modals-provider';
import {
  findActiveLocalAccount,
  localAccountSubtitle,
} from '@libs/auth/client/local-account-helpers';
import { useIsSignedIn } from '@libs/auth/client/use-current-user';
import {
  accountDisplayTitle,
  useLocalAccounts,
  type LocalAccount,
} from '@libs/auth/client/use-local-accounts';
import { DeviceAvatar } from '@libs/profile/client/device-avatar';
import type { LocalizedString } from '@pkgs/i18n';
import {
  LogInIcon,
  LogOutIcon,
  SettingsIcon,
  iconButtonAvatarContentSize,
  releaseWebFocus,
  type ActionBarItem,
} from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, type ReactNode } from 'react';

import { LocalAccountAvatar } from './local-account-avatar';

const TRIGGER_SIZE = 36;
const MENU_AVATAR_SIZE = 28;

type AccountMenuLabels = {
  account: LocalizedString;
  settings: LocalizedString;
  signIn: LocalizedString;
  signOut: LocalizedString;
  userMenu: LocalizedString;
  notSignedIn: LocalizedString;
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
      notSignedIn: t`Not signed in`,
    }),
    [t]
  );
}

export function useActiveLocalAccount(): LocalAccount | undefined {
  const accounts = useLocalAccounts();
  return useMemo(() => findActiveLocalAccount(accounts), [accounts]);
}

function useAccountMenuHandlers() {
  const isAuthenticated = useIsSignedIn();
  const { open: openSignInModal } = useSignInModal();
  const { open: openSignOutConfirm } = useSignOutModal();
  const router = useRouter();

  const onAccount = useCallback(() => {
    releaseWebFocus();
    router.push('/more/account');
  }, [router]);

  const onSettings = useCallback(() => {
    releaseWebFocus();
    router.push('/more');
  }, [router]);

  const onSignIn = useCallback(() => {
    releaseWebFocus();
    openSignInModal();
  }, [openSignInModal]);

  const onSignOut = useCallback(() => {
    releaseWebFocus();
    openSignOutConfirm();
  }, [openSignOutConfirm]);

  return {
    isAuthenticated,
    onAccount,
    onSettings,
    onSignIn,
    onSignOut,
  };
}

function useCurrentUserMenuItem(
  labels: AccountMenuLabels,
  onAccount: () => void
): ActionBarItem {
  const active = useActiveLocalAccount();

  return useMemo((): ActionBarItem => {
    if (active === undefined) {
      return {
        id: 'account',
        variant: 'avatar',
        label: labels.notSignedIn,
        accessibilityLabel: labels.account,
        children: (
          <DeviceAvatar
            avatarConfig={null}
            seedFallback="signed-out"
            size={MENU_AVATAR_SIZE}
          />
        ),
        onPress: onAccount,
        overflow: 'always',
      };
    }
    const title = accountDisplayTitle(active);
    const subtitle = localAccountSubtitle(active);
    return {
      id: 'account',
      variant: 'avatar',
      label: title,
      ...(subtitle !== undefined ? { subtitle } : {}),
      accessibilityLabel: labels.account,
      children: <LocalAccountAvatar account={active} size={MENU_AVATAR_SIZE} />,
      onPress: onAccount,
      overflow: 'always',
    };
  }, [active, labels, onAccount]);
}

export function useAccountMenuItems(): ActionBarItem[] {
  const labels = useAccountMenuLabels();
  const { isAuthenticated, onAccount, onSettings, onSignIn, onSignOut } =
    useAccountMenuHandlers();
  const accountItem = useCurrentUserMenuItem(labels, onAccount);

  return useMemo((): ActionBarItem[] => {
    const items: ActionBarItem[] = [
      { ...accountItem, endsGroup: true },
      {
        id: 'settings',
        label: labels.settings,
        icon: SettingsIcon,
        onPress: onSettings,
        overflow: 'always',
        endsGroup: true,
      },
    ];

    if (isAuthenticated) {
      items.push({
        id: 'sign-out',
        label: labels.signOut,
        icon: LogOutIcon,
        onPress: onSignOut,
        overflow: 'always',
      });
    } else {
      items.push({
        id: 'sign-in',
        label: labels.signIn,
        icon: LogInIcon,
        onPress: onSignIn,
        overflow: 'always',
      });
    }

    return items;
  }, [accountItem, isAuthenticated, labels, onSettings, onSignIn, onSignOut]);
}

export function useAccountMenuTriggerLabel(): LocalizedString {
  const { t } = useLingui();
  return t`User menu`;
}

export function AccountMenuTriggerAvatar({
  size,
}: {
  size: number;
}): ReactNode {
  const active = useActiveLocalAccount();
  if (active === undefined) {
    return (
      <DeviceAvatar avatarConfig={null} seedFallback="signed-out" size={size} />
    );
  }
  return <LocalAccountAvatar account={active} size={size} />;
}

export { TRIGGER_SIZE as ACCOUNT_MENU_TRIGGER_SIZE };

export function useAccountMenuTriggerSize(): number {
  return iconButtonAvatarContentSize(TRIGGER_SIZE);
}
