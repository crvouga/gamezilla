/**
 * Compact account menu items for tab-root headers.
 */

import {
  useSignInModal,
  useSignOutModal,
} from '@libs/auth/client/auth-modals-provider';
import { useAuthClientPort } from '@libs/auth/client/auth-client-provider';
import { useIsSignedIn } from '@libs/auth/client/use-current-user';
import { DeviceAvatar } from '@libs/profile/client/device-avatar';
import { MyProfileAvatar } from '@libs/profile/client/my-profile-avatar';
import { useMyProfileId } from '@libs/profile/client/use-my-profile-id';
import { useProfileColumn } from '@libs/profile/client/use-profile-column';
import type { LocalizedString } from '@pkgs/i18n';
import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';
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

function useSessionEmail(): string | null {
  const port = useAuthClientPort();
  return port.useAuthSession().session?.email ?? null;
}

/** SQLite username only when account id is bound and the engine matches it. */
function useReadyProfileUsername(): string | null {
  const isSignedIn = useIsSignedIn();
  const paintReady = useSyncEnginePaintReady();
  const profileId = useMyProfileId();
  const watchId =
    isSignedIn && paintReady && profileId !== null ? profileId : '';
  return useProfileColumn(watchId, 'username');
}

function signedOutAccountMenuItem(
  labels: AccountMenuLabels,
  onAccount: () => void,
  email: string | null
): ActionBarItem {
  const label = email !== null && email.length > 0 ? email : labels.notSignedIn;
  return {
    id: 'account',
    variant: 'avatar',
    label,
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

function signedInAccountMenuItem(
  labels: AccountMenuLabels,
  onAccount: () => void,
  username: string | null,
  email: string | null
): ActionBarItem {
  const title =
    username !== null && username.length > 0
      ? username
      : email !== null && email.length > 0
        ? email
        : labels.account;
  const subtitle =
    email !== null && email.length > 0 && email !== title ? email : undefined;
  return {
    id: 'account',
    variant: 'avatar',
    label: title,
    ...(subtitle !== undefined ? { subtitle } : {}),
    accessibilityLabel: labels.account,
    children: <MyProfileAvatar size={MENU_AVATAR_SIZE} />,
    onPress: onAccount,
    overflow: 'always',
  };
}

function useCurrentUserMenuItem(
  labels: AccountMenuLabels,
  onAccount: () => void
): ActionBarItem {
  const isSignedIn = useIsSignedIn();
  const username = useReadyProfileUsername();
  const email = useSessionEmail();

  return useMemo((): ActionBarItem => {
    if (!isSignedIn) {
      return signedOutAccountMenuItem(labels, onAccount, email);
    }
    return signedInAccountMenuItem(labels, onAccount, username, email);
  }, [isSignedIn, username, email, labels, onAccount]);
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
  const isSignedIn = useIsSignedIn();
  if (!isSignedIn) {
    return (
      <DeviceAvatar avatarConfig={null} seedFallback="signed-out" size={size} />
    );
  }
  return <MyProfileAvatar size={size} />;
}

export { TRIGGER_SIZE as ACCOUNT_MENU_TRIGGER_SIZE };

export function useAccountMenuTriggerSize(): number {
  return iconButtonAvatarContentSize(TRIGGER_SIZE);
}
