/** @jsxImportSource solid-js */
/**
 * Global dropdown mounted as `AppFrameChromeProvider` `globalTrailing` so
 * every top bar shares it. Rows: Settings, Connectivity (→ Connection in
 * Settings), Account, Theme, Sound. Header shows `@username` and an email when one is published
 * (bridged from the sync tree via {@link useGlobalMenuIdentity}). Trigger face
 * is the current user's avatar when available. The chrome shows identity only:
 * it knows nothing of sign-in state or membership, so it cannot branch on them.
 */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import { useSoundsPreference } from '@pkgs/sounds-client-ts/solid';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import {
  PaintbrushIcon,
  SettingsIcon,
  UserIcon,
  Volume2Icon,
  VolumeXIcon,
} from '@pkgs/ui-root-client-ts/icons';
import type {
  OverflowMenuAction,
  OverflowMenuHeader,
} from '@pkgs/ui-root-client-ts/overflow-menu-button';
import { OverflowMenuButton } from '@pkgs/ui-root-client-ts/overflow-menu-button';
import type { StatusDotStatus } from '@pkgs/ui-root-client-ts/status-dot';
import { StatusDot } from '@pkgs/ui-root-client-ts/status-dot';
import { useThemePreference } from '@pkgs/ui-root-client-ts/theme-preference';
import { type Accessor, createMemo, type JSX } from 'solid-js';

import type { GlobalMenuIdentity } from './global-menu-identity-context';
import { useGlobalMenuIdentity } from './global-menu-identity-context';
import { createConnectivity } from './use-connectivity';

const CONNECTIVITY_DOT_SIZE = 14;
const TRIGGER_AVATAR_SIZE = 32;
const HEADER_AVATAR_SIZE = 40;

/**
 * `t` must come from `useLingui()` in this scope: the macro compiles only
 * that binding, so a `t` passed in as an argument renders every label empty.
 */
function useConnectivityStatusLabel(): (status: StatusDotStatus) => string {
  const { t } = useLingui();
  return (status) => {
    if (status === 'online') return t`Online`;
    if (status === 'offline') return t`Offline`;
    if (status === 'pending') return t`Syncing`;
    return t`Sync issue`;
  };
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

/**
 * The Connectivity row: its label, then the status in words beside a status
 * dot. It is named by what it shows ("Connectivity Online"), so a listener
 * hears the visible label (WCAG 2.5.3).
 */
export function connectivityMenuAction(row: {
  readonly label: string;
  readonly status: StatusDotStatus;
  readonly statusLabel: string;
  readonly onClick: () => void;
}): OverflowMenuAction {
  return {
    id: 'connectivity',
    label: row.label,
    subtitle: row.statusLabel,
    leading: <StatusDot status={row.status} size={CONNECTIVITY_DOT_SIZE} />,
    onClick: row.onClick,
  };
}

function useGlobalMenuActions(): Accessor<readonly OverflowMenuAction[]> {
  const { t } = useLingui();
  const router = useRouter();
  const connectivity = createConnectivity();
  const themeCaption = useThemeCaption();
  const connectivityStatusLabel = useConnectivityStatusLabel();
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
      ...connectivityMenuAction({
        label: t`Connectivity`,
        status: connectivity.status(),
        statusLabel: connectivityStatusLabel(connectivity.status()),
        onClick: go('/more/server-status'),
      }),
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

/** Shell default face when no sub published one: your own placeholder. */
function DefaultAccountFace(props: { readonly size: number }): JSX.Element {
  return <Avatar size={props.size} you />;
}

function accountFace(identity: GlobalMenuIdentity, size: number): JSX.Element {
  const render = identity.avatar;
  if (render === null) return <DefaultAccountFace size={size} />;
  return render(size);
}

function useGlobalMenuHeader(): Accessor<OverflowMenuHeader> {
  const { t } = useLingui();
  const menuIdentity = useGlobalMenuIdentity();
  return createMemo(() => {
    const current = menuIdentity();
    const { usernameLabel, email } = current;
    const avatar = accountFace(current, HEADER_AVATAR_SIZE);
    if (usernameLabel !== null && usernameLabel.length > 0) {
      return {
        title: usernameLabel,
        subtitle: email ?? undefined,
        avatar,
      };
    }
    if (email !== null && email.length > 0) {
      return { title: email, avatar };
    }
    return { title: t`Account`, avatar };
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
