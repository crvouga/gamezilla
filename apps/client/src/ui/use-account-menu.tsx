import {
  useSignInModal,
  useSignOutModal,
} from '@libs/auth/client/auth-modals-provider';
import { useIsSignedIn } from '@libs/auth/client/use-current-user';
import {
  useLocalAccounts,
  type LocalAccount,
} from '@libs/auth/client/use-local-accounts';
import { useSwitchAccount } from '@libs/auth/client/use-switch-account';
import { parseAvatarConfig } from '@libs/profile/shared/avatar-config';
import { DeviceAvatar } from '@libs/profile/client/device-avatar';
import { MyUsername } from '@libs/profile/client/my-username';
import { MyProfileAvatar } from '@libs/profile/client/my-profile-avatar';
import type { LocalizedString } from '@pkgs/i18n';
import {
  CircleCheckIcon,
  LogInIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
  UserIcon,
  iconButtonAvatarContentSize,
  type ActionBarItem,
  type FloatingMenuHeaderSpec,
} from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, type ReactNode } from 'react';

const TRIGGER_SIZE = 36;
const MENU_AVATAR_SIZE = 28;

type AccountMenuLabels = {
  account: LocalizedString;
  settings: LocalizedString;
  signIn: LocalizedString;
  signOut: LocalizedString;
  addAccount: LocalizedString;
  userMenu: LocalizedString;
  accountFallback: LocalizedString;
};

function useAccountMenuLabels(): AccountMenuLabels {
  const { t } = useLingui();
  return useMemo(
    () => ({
      account: t`Account`,
      settings: t`Settings`,
      signIn: t`Sign in`,
      signOut: t`Sign out`,
      addAccount: t`Add account`,
      userMenu: t`User menu`,
      accountFallback: t`Account`,
    }),
    [t]
  );
}

function accountLabel(
  account: LocalAccount,
  fallback: LocalizedString
): string {
  if (account.username !== null && account.username.length > 0) {
    return account.username;
  }
  if (account.email !== null && account.email.length > 0) {
    return account.email;
  }
  return fallback;
}

function AccountMenuAvatar({ account }: { account: LocalAccount }): ReactNode {
  const seed = account.accountId ?? account.externalUserId ?? account.sessionId;
  return (
    <DeviceAvatar
      avatarConfig={parseAvatarConfig(account.avatarConfigJson)}
      seedFallback={seed}
      size={MENU_AVATAR_SIZE}
    />
  );
}

function useAccountSwitchItems(labels: AccountMenuLabels): ActionBarItem[] {
  const accounts = useLocalAccounts();
  const switchAccount = useSwitchAccount();
  const router = useRouter();

  const onSwitch = useCallback(
    (sessionId: string, isActive: boolean) => {
      if (isActive) return;
      void (async () => {
        await switchAccount(sessionId);
        router.replace('/');
      })();
    },
    [switchAccount, router]
  );

  return useMemo(() => {
    if (accounts.length === 0) return [];
    return accounts.map((account, index) => {
      const isLast = index === accounts.length - 1;
      return {
        id: `switch-${account.sessionId}`,
        variant: 'avatar' as const,
        label: accountLabel(account, labels.accountFallback),
        children: <AccountMenuAvatar account={account} />,
        onPress: () => onSwitch(account.sessionId, account.isActive),
        overflow: 'always' as const,
        endsGroup: isLast,
        ...(account.isActive
          ? { trailing: <CircleCheckIcon size={18} /> }
          : {}),
      };
    });
  }, [accounts, labels.accountFallback, onSwitch]);
}

function useAccountMenuHandlers() {
  const isAuthenticated = useIsSignedIn();
  const { open: openSignInModal } = useSignInModal();
  const { open: openSignOutConfirm } = useSignOutModal();
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

  const onAddAccount = useCallback(() => {
    openSignInModal();
  }, [openSignInModal]);

  const onSignOut = useCallback(() => {
    openSignOutConfirm();
  }, [openSignOutConfirm]);

  return {
    isAuthenticated,
    onAccount,
    onSettings,
    onSignIn,
    onAddAccount,
    onSignOut,
  };
}

export function useAccountMenuItems(): ActionBarItem[] {
  const labels = useAccountMenuLabels();
  const switchItems = useAccountSwitchItems(labels);
  const {
    isAuthenticated,
    onAccount,
    onSettings,
    onSignIn,
    onAddAccount,
    onSignOut,
  } = useAccountMenuHandlers();

  return useMemo((): ActionBarItem[] => {
    const items: ActionBarItem[] = [...switchItems];

    if (isAuthenticated) {
      items.push({
        id: 'add-account',
        label: labels.addAccount,
        icon: PlusIcon,
        onPress: onAddAccount,
        overflow: 'always',
        endsGroup: true,
      });
    }

    items.push(
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
        endsGroup: true,
      }
    );

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
  }, [
    switchItems,
    isAuthenticated,
    labels,
    onAccount,
    onSettings,
    onSignIn,
    onAddAccount,
    onSignOut,
  ]);
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
