/** @jsxImportSource solid-js */
/**
 * Global dropdown mounted as `AppFrameChromeProvider` `globalTrailing` so
 * every top bar shares it. Rows: Settings, connectivity (→ Sync), Server
 * status, Theme, Sound, UI explorer (dev bundles only).
 *
 * Deferred: the Account row + identity header (`@username`, avatar trigger)
 * join with the auth / profile screen ports (`useMyProfileId`,
 * `MyProfileAvatar` are UI-bound). The trigger is the plain user glyph
 * until then; the header shows guest / signed-in from the local identity.
 */

import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/solid/macro';
import { useSoundsPreference } from '@pkgs/sounds/solid';
import {
  type OverflowMenuAction,
  OverflowMenuButton,
  PaintbrushIcon,
  ServerIcon,
  SettingsIcon,
  SquareStackIcon,
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
import { createConnectivity } from './use-connectivity';

const CONNECTIVITY_DOT_SIZE = 14;

function connectivityTitle(
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
      label: connectivityTitle(t, connectivity.status()),
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
    ...(import.meta.env.DEV
      ? [
          {
            id: 'ui-explorer',
            label: t`UI explorer`,
            icon: SquareStackIcon,
            onClick: go('/ui'),
          },
        ]
      : []),
  ];
}

export function AppHeaderGlobalMenu(): JSX.Element {
  const { t } = useLingui();
  const identity = useLocalIdentity();
  const actions = useGlobalMenuActions();
  return (
    <OverflowMenuButton
      actions={actions()}
      header={{
        title: identity.isSignedIn() ? t`Signed in` : t`Guest`,
        subtitle: identity.isSignedIn() ? undefined : t`Playing as guest`,
      }}
      icon={UserIcon}
      aria-label={t`Account menu`}
      dataSet={{ testid: Handles.statusCurrentUser }}
    />
  );
}
