/** @jsxImportSource solid-js */
/**
 * Global dropdown mounted as `AppFrameChromeProvider` `globalTrailing` so
 * every top bar shares it. Rows: Settings, Connectivity, Server, Account,
 * Theme, Sound. Header shows `@username` + email when signed in (bridged
 * from the sync tree via {@link useGlobalMenuIdentity}). Trigger face is the
 * current user's avatar when available. The header's trailing chip is the
 * membership tier a feature published ({@link useGlobalMenuMembership}).
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
import { type Accessor, createMemo, type JSX } from 'solid-js';

import { useLocalIdentity } from '../shell/identity/identity-context';
import {
  type GlobalMenuIdentity,
  useGlobalMenuIdentity,
} from './global-menu-identity-context';
import { GlobalMenuMembershipChip } from './global-menu-membership-chip';
import { useGlobalMenuMembership } from './global-menu-membership-context';
import { createConnectivity } from './use-connectivity';

const CONNECTIVITY_DOT_SIZE = 14;
const TRIGGER_AVATAR_SIZE = 32;
const HEADER_AVATAR_SIZE = 40;

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

function useGlobalMenuActions(): Accessor<readonly OverflowMenuAction[]> {
  const { t } = useLingui();
  const router = useRouter();
  const connectivity = createConnectivity();
  const themeCaption = useThemeCaption();
  const { muted } = useSoundsPreference();
  const go = (href: string) => () => router.push(href);
  return createMemo(() => [
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
  ]);
}

/** Shell default face when no feature published one. */
function DefaultAccountFace(props: { readonly size: number }): JSX.Element {
  return <UserIcon size={props.size} />;
}

function accountFace(identity: GlobalMenuIdentity, size: number): JSX.Element {
  const render = identity.avatar;
  if (render === null) return <DefaultAccountFace size={size} />;
  return render(size);
}

function useGlobalMenuHeader(): Accessor<OverflowMenuHeader> {
  const { t } = useLingui();
  const identity = useLocalIdentity();
  const menuIdentity = useGlobalMenuIdentity();
  const membership = useGlobalMenuMembership();
  return createMemo(() => {
    const current = menuIdentity();
    const { username, email } = current;
    const avatar = accountFace(current, HEADER_AVATAR_SIZE);
    const published = membership();
    const badge =
      published === null ? undefined : (
        <GlobalMenuMembershipChip membership={published} />
      );
    if (!identity.isSignedIn()) {
      return {
        title: t`Guest`,
        subtitle: t`Playing as guest`,
        avatar,
        badge,
      };
    }
    if (username !== null && username.length > 0) {
      return {
        title: `@${username}`,
        subtitle: email ?? undefined,
        avatar,
        badge,
      };
    }
    if (email !== null && email.length > 0) {
      return { title: email, avatar, badge };
    }
    return { title: t`Account`, avatar, badge };
  });
}

export function AppHeaderGlobalMenu(): JSX.Element {
  const { t } = useLingui();
  const actions = useGlobalMenuActions();
  const header = useGlobalMenuHeader();
  const menuIdentity = useGlobalMenuIdentity();
  const trigger = createMemo(() =>
    accountFace(menuIdentity(), TRIGGER_AVATAR_SIZE)
  );
  return (
    <OverflowMenuButton
      placement="bottom-end"
      tooltipPlacement="bottom-end"
      actions={actions()}
      header={header()}
      trigger={trigger()}
      aria-label={t`Account menu`}
      dataSet={{ testid: Handles.statusCurrentUser }}
    />
  );
}
