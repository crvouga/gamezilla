import {
  useSignInModal,
  useSignOutModal,
} from '@libs/auth/client/auth-modals-provider';
import { useIsSignedIn } from '@libs/auth/client/use-current-user';
import {
  useLocalAccounts,
  accountDisplayTitle,
  type LocalAccount,
} from '@libs/auth/client/use-local-accounts';
import { useSwitchAccount } from '@libs/auth/client/use-switch-account';
import {
  createDefaultAvatarConfig,
  parseAvatarConfig,
} from '@libs/profile/shared/avatar-config';
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
  Spinner,
  UserIcon,
  iconButtonAvatarContentSize,
  type ActionBarItem,
  type FloatingMenuHeaderSpec,
} from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

const TRIGGER_SIZE = 36;
const MENU_AVATAR_SIZE = 28;

type AccountMenuLabels = {
  account: LocalizedString;
  settings: LocalizedString;
  signIn: LocalizedString;
  signOut: LocalizedString;
  addAccount: LocalizedString;
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
      addAccount: t`Add account`,
      userMenu: t`User menu`,
    }),
    [t]
  );
}

function accountSubtitle(account: LocalAccount): string | undefined {
  if (account.email !== null && account.email.length > 0) {
    return account.email;
  }
  return undefined;
}

function accountAccessibilityLabel(
  title: string,
  subtitle: string | undefined
): LocalizedString {
  if (subtitle === undefined) return title as LocalizedString;
  return `${title}, ${subtitle}` as LocalizedString;
}

function AccountMenuAvatar({ account }: { account: LocalAccount }): ReactNode {
  if (account.isActive) {
    return <MyProfileAvatar size={MENU_AVATAR_SIZE} />;
  }
  const seed = account.accountId ?? account.externalUserId ?? account.sessionId;
  const parsed = parseAvatarConfig(account.avatarConfigJson);
  return (
    <DeviceAvatar
      avatarConfig={parsed ?? createDefaultAvatarConfig(seed)}
      seedFallback={seed}
      size={MENU_AVATAR_SIZE}
    />
  );
}

function useAccountSwitchItems(): ActionBarItem[] {
  const accounts = useLocalAccounts();
  const switchAccount = useSwitchAccount();
  const router = useRouter();
  const [switchingSessionId, setSwitchingSessionId] = useState<string | null>(
    null
  );

  const onSwitch = useCallback(
    (account: LocalAccount) => {
      if (account.isActive || switchingSessionId !== null) return;
      setSwitchingSessionId(account.sessionId);
      void (async () => {
        try {
          await switchAccount({
            sessionId: account.sessionId,
            accountId: account.accountId,
          });
          router.replace('/');
        } catch {
          setSwitchingSessionId(null);
        }
      })();
    },
    [switchAccount, router, switchingSessionId]
  );

  return useMemo(() => {
    if (accounts.length === 0) return [];
    const isSwitching = switchingSessionId !== null;
    return accounts.map((account, index) => {
      const isLast = index === accounts.length - 1;
      const title = accountDisplayTitle(account);
      const subtitle = accountSubtitle(account);
      const isTarget = switchingSessionId === account.sessionId;
      return {
        id: `switch-${account.sessionId}`,
        variant: 'avatar' as const,
        label: title,
        ...(subtitle !== undefined ? { subtitle } : {}),
        accessibilityLabel: accountAccessibilityLabel(title, subtitle),
        children: <AccountMenuAvatar account={account} />,
        onPress: () => onSwitch(account),
        overflow: 'always' as const,
        endsGroup: isLast,
        disabled: isSwitching && !isTarget,
        loading: isTarget,
        ...(isTarget
          ? { trailing: <Spinner size="small" /> }
          : account.isActive
            ? { trailing: <CircleCheckIcon size={18} /> }
            : {}),
      };
    });
  }, [accounts, onSwitch, switchingSessionId]);
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
  const switchItems = useAccountSwitchItems();
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
  const accounts = useLocalAccounts();
  const avatarSize = iconButtonAvatarContentSize(TRIGGER_SIZE);
  const activeEmail = useMemo(() => {
    const active = accounts.find((account) => account.isActive);
    if (active === undefined) return undefined;
    return accountSubtitle(active);
  }, [accounts]);

  return useMemo(
    (): FloatingMenuHeaderSpec => ({
      avatar: <MyProfileAvatar size={avatarSize} />,
      title: <MyUsername variant="bodyBold" />,
      ...(activeEmail !== undefined ? { subtitle: activeEmail } : {}),
    }),
    [avatarSize, activeEmail]
  );
}

export function useAccountMenuTriggerLabel(): LocalizedString {
  const { t } = useLingui();
  return t`User menu`;
}

export { TRIGGER_SIZE as ACCOUNT_MENU_TRIGGER_SIZE };
