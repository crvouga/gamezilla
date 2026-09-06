/**
 * Current-user avatar dropdown. The panel header is the identity block
 * (avatar + `@username` + session state); rows are grouped as
 * account / settings, connectivity, then quick preferences. Mounted as
 * AppFrame `globalTrailing` so every top bar shares the same menu.
 */

import { useServerStatus } from '@apps/client/connection/use-server-status';
import {
  useHasAuthSession,
  useIsAnon,
} from '@libs/auth/public/use-current-user';
import {
  notificationsPath,
  useNotificationsUnreadCount,
} from '@libs/notifications/public';
import { useMyProfileId } from '@libs/profile/public/use-my-profile-id';
import { useProfileColumn } from '@libs/profile/public/use-profile-column';
import { MyProfileAvatar } from '@libs/profile/root/client/my-profile-avatar';
import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/react/macro';
import { useTimers } from '@pkgs/clock';
import { useOptionalOriginAvailability } from '@pkgs/http-client';
import { useSoundsPreference } from '@pkgs/sounds';
import { useSyncEngine } from '@pkgs/sync-engine/client';
import {
  BellIcon,
  type OverflowMenuAction,
  OverflowMenuButton,
  PaintbrushIcon,
  ServerIcon,
  SettingsIcon,
  StatusDot,
  type StatusDotStatus,
  UserIcon,
  useRouter,
  useThemePreference,
  Volume2Icon,
  VolumeXIcon,
} from '@pkgs/ui';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

import { resolveConnectivityStatus } from './resolve-connectivity-status';

const AVATAR_SIZE = 32;
const REFRESH_INTERVAL_MS = 15_000;

function useBrowserOnline(): boolean {
  const [online, setOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine !== false
  );
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const goOnline = (): void => setOnline(true);
    const goOffline = (): void => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  return online;
}

function useConnectivityLabels(): {
  readonly title: string;
  readonly caption: string;
  readonly status: StatusDotStatus;
} {
  const { t } = useLingui();
  const { status: syncStatus } = useSyncEngine();
  const browserOnline = useBrowserOnline();
  const syncError =
    syncStatus.lastError !== null && syncStatus.lastError.length > 0;
  const status = resolveConnectivityStatus({
    browserOnline,
    syncOnline: syncStatus.online,
    syncError,
    connection: syncStatus.connection,
    hasSynced: syncStatus.hasSynced,
  });
  const title =
    status === 'online'
      ? t`Online`
      : status === 'offline'
        ? t`Offline`
        : status === 'pending'
          ? t`Syncing`
          : t`Sync issue`;
  const caption =
    status === 'online' || status === 'pending'
      ? syncStatus.connection
      : status === 'warning'
        ? t`Error`
        : title;
  return { title, caption, status };
}

function useServerCaption(): string {
  const { t } = useLingui();
  const timers = useTimers();
  const availability = useOptionalOriginAvailability();
  const { health, refresh } = useServerStatus();
  useEffect(() => {
    if (availability?.kind !== 'health') return;
    if (health.phase !== 'success') return;
    const id = timers.setInterval(() => refresh(), REFRESH_INTERVAL_MS);
    return () => timers.clearInterval(id);
  }, [availability, health.phase, refresh, timers]);
  return health.latencyMs === null ? t`Checking…` : t`${health.latencyMs} ms`;
}

type MenuCopy = {
  readonly identityTitle: string;
  readonly identityCaption: string;
  readonly connectivity: {
    readonly title: string;
    readonly caption: string;
    readonly status: StatusDotStatus;
  };
  readonly serverCaption: string;
  readonly accountCaption: string;
  readonly themeCaption: string;
  readonly soundCaption: string;
  readonly notificationsCaption: string;
  readonly muted: boolean;
  readonly labels: {
    readonly server: string;
    readonly account: string;
    readonly settings: string;
    readonly theme: string;
    readonly sound: string;
    readonly notifications: string;
  };
};

function buildGlobalMenuActions(
  copy: MenuCopy,
  push: (href: string) => void
): readonly OverflowMenuAction[] {
  return [
    {
      id: 'account',
      label: copy.labels.account,
      subtitle: copy.accountCaption,
      icon: UserIcon,
      onPress: () => {
        push('/more/account');
      },
      testID: Handles.globalMenuAccount,
    },
    {
      id: 'settings',
      label: copy.labels.settings,
      icon: SettingsIcon,
      onPress: () => {
        push('/more');
      },
      endsGroup: true,
    },
    {
      id: 'connectivity',
      label: copy.connectivity.title,
      subtitle: copy.connectivity.caption,
      leading: <StatusDot status={copy.connectivity.status} size={14} />,
      onPress: () => {
        push('/more/sync');
      },
    },
    {
      id: 'server',
      label: copy.labels.server,
      subtitle: copy.serverCaption,
      icon: ServerIcon,
      onPress: () => {
        push('/more/server-status');
      },
      endsGroup: true,
    },
    {
      id: 'theme',
      label: copy.labels.theme,
      subtitle: copy.themeCaption,
      icon: PaintbrushIcon,
      onPress: () => {
        push('/more/theme');
      },
    },
    {
      id: 'sound',
      label: copy.labels.sound,
      subtitle: copy.soundCaption,
      icon: copy.muted ? VolumeXIcon : Volume2Icon,
      onPress: () => {
        push('/more/sound');
      },
    },
    {
      id: 'notifications',
      label: copy.labels.notifications,
      subtitle: copy.notificationsCaption,
      icon: BellIcon,
      onPress: () => {
        push(notificationsPath());
      },
    },
  ];
}

function useMyUsername(): string | null {
  const profileId = useMyProfileId();
  const username = useProfileColumn(profileId ?? '', 'username');
  return username !== null && username.length > 0 ? username : null;
}

function useGlobalMenuCopy(): MenuCopy {
  const { t } = useLingui();
  const connectivity = useConnectivityLabels();
  const serverCaption = useServerCaption();
  const isAnon = useIsAnon();
  const signedIn = useHasAuthSession();
  const username = useMyUsername();
  const { preference } = useThemePreference();
  const { muted } = useSoundsPreference();
  const unread = useNotificationsUnreadCount();
  const isMember = signedIn && !isAnon;
  return {
    identityTitle: username === null ? t`Guest` : `@${username}`,
    identityCaption: isMember ? t`Signed in` : t`Playing as guest`,
    connectivity,
    serverCaption,
    accountCaption: isMember ? t`Sign-in, devices` : t`Sign in to sync`,
    themeCaption:
      preference === 'light'
        ? t`Light`
        : preference === 'dark'
          ? t`Dark`
          : t`System`,
    soundCaption: muted ? t`Muted` : t`On`,
    notificationsCaption:
      unread === 0 ? t`None` : unread === 1 ? t`1 unread` : t`${unread} unread`,
    muted,
    labels: {
      server: t`Server`,
      account: t`Account`,
      settings: t`Settings`,
      theme: t`Theme`,
      sound: t`Sound`,
      notifications: t`Notifications`,
    },
  };
}

export function AppHeaderGlobalMenu(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const push = useCallback(
    (href: string) => {
      router.push(href as never);
    },
    [router]
  );
  const copy = useGlobalMenuCopy();
  const actions = useMemo(
    () => buildGlobalMenuActions(copy, push),
    [copy, push]
  );

  return (
    <OverflowMenuButton
      actions={actions}
      header={{
        title: copy.identityTitle,
        subtitle: copy.identityCaption,
        avatar: <MyProfileAvatar size={40} />,
      }}
      accessibilityLabel={t`Account menu`}
      testID={Handles.statusCurrentUser}
      trigger={<MyProfileAvatar size={AVATAR_SIZE} />}
    />
  );
}
