/** @jsxImportSource solid-js */
/**
 * Global dropdown mounted as `AppFrameChromeProvider` `globalTrailing` so
 * every top bar shares it. Rows: Settings, Connectivity, Server, Account,
 * Theme, Sound. Header shows `@username` + email when signed in (bridged
 * from the sync tree via {@link useGlobalMenuIdentity}).
 */

import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/solid/macro';
import { useSoundsPreference } from '@pkgs/sounds/solid';
import {
  type OverflowMenuAction,
  OverflowMenuButton,
  type OverflowMenuHeader,
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
import type { JSX } from 'solid-js';

import { useLocalIdentity } from '../shell/identity/identity-context';
import { useGlobalMenuIdentity } from './global-menu-identity-context';
import { createConnectivity } from './use-connectivity';

const CONNECTIVITY_DOT_SIZE = 14;

function connectivityStatusLabel(
  t: ReturnType<typeof useLingui>['t'],
  status: StatusDotStatus
): string {
  if (status === 'online') return t`Online`;
  if (status === 'offline') return t`Offline`;
  if (status === 'pending') return t`Syncing`;
  return t`Sync issue`;
}

function useThemeCaption(): () => string {
  const { t } = useLingui();
  const { preference } = useThemePreference();
  return () => {
    const p = preference();
    if (p === 'light') return t`Light`;
    if (p === 'dark') return t`Dark`;
    return t`System`;
  };
}

function useGlobalMenuActions(): () => readonly OverflowMenuAction[] {
  const { t } = useLingui();
  const router = useRouter();
  const connectivity = createConnectivity();
  const themeCaption = useThemeCaption();
  const { muted } = useSoundsPreference();
  const go = (href: string) => () => router.push(href);
  return () => [
    {
      id: 'settings',
      label: t`Settings`,
      icon: SettingsIcon,
      onClick: go('/more'),
      endsGroup: true,
      dataSet: { testid: Handles.globalMenuSettings },
    },
    {
      id: 'connectivity',
      label: t`Connectivity`,
      subtitle: connectivityStatusLabel(t, connectivity.status()),
      'aria-label': connectivityStatusLabel(t, connectivity.status()),
      leading: (
        <StatusDot
          status={connectivity.status()}
          size={CONNECTIVITY_DOT_SIZE}
        />
      ),
      onClick: go('/more/sync'),
    },
    {
      id: 'server',
      label: t`Server`,
      icon: ServerIcon,
      onClick: go('/more/server-status'),
      endsGroup: true,
    },
    {
      id: 'account',
      label: t`Account`,
      icon: UserIcon,
      onClick: go('/more/account'),
      endsGroup: true,
      dataSet: { testid: Handles.globalMenuAccount },
    },
    {
      id: 'theme',
      label: t`Theme`,
      subtitle: themeCaption(),
      icon: PaintbrushIcon,
      onClick: go('/more/theme'),
    },
    {
      id: 'sound',
      label: t`Sound`,
      subtitle: muted() ? t`Muted` : t`On`,
      icon: muted() ? VolumeXIcon : Volume2Icon,
      onClick: go('/more/sound'),
    },
  ];
}

function useGlobalMenuHeader(): () => OverflowMenuHeader {
  const { t } = useLingui();
  const identity = useLocalIdentity();
  const menuIdentity = useGlobalMenuIdentity();
  return () => {
    if (!identity.isSignedIn()) {
      return { title: t`Guest`, subtitle: t`Playing as guest` };
    }
    const { username, email } = menuIdentity();
    if (username !== null && username.length > 0) {
      return {
        title: `@${username}`,
        subtitle: email ?? undefined,
      };
    }
    if (email !== null && email.length > 0) {
      return { title: email };
    }
    return { title: t`Account` };
  };
}

export function AppHeaderGlobalMenu(): JSX.Element {
  const { t } = useLingui();
  const actions = useGlobalMenuActions();
  const header = useGlobalMenuHeader();
  return (
    <OverflowMenuButton
      placement="bottom-end"
      tooltipPlacement="bottom-end"
      actions={actions()}
      header={header()}
      icon={UserIcon}
      aria-label={t`Account menu`}
      dataSet={{ testid: Handles.statusCurrentUser }}
    />
  );
}
