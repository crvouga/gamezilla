/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
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
import type { ThemePreference } from '@pkgs/ui-root-client-ts/theme-preference';
import { type Accessor, createMemo, type JSX } from 'solid-js';

import type { GlobalMenuIdentity } from '@libs/app-env-client-ts/global-menu-identity-context';

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

export type AppHeaderGlobalMenuViewProps = {
  /** Who is signed in on this device, as the identity publisher shows it. */
  readonly identity: GlobalMenuIdentity;
  /** The connection in one dot: online, offline, syncing or a sync issue. */
  readonly connectivity: StatusDotStatus;
  readonly theme: ThemePreference;
  readonly muted: boolean;
  /** Open the row's screen. */
  readonly onNavigate: (href: string) => void;
};

function useThemeCaption(props: AppHeaderGlobalMenuViewProps): () => string {
  const { t } = useLingui();
  return () => {
    const p = props.theme;
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

function useGlobalMenuActions(
  props: AppHeaderGlobalMenuViewProps
): Accessor<readonly OverflowMenuAction[]> {
  const { t } = useLingui();
  const themeCaption = useThemeCaption(props);
  const connectivityStatusLabel = useConnectivityStatusLabel();
  const go = (href: string) => () => props.onNavigate(href);
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
        status: props.connectivity,
        statusLabel: connectivityStatusLabel(props.connectivity),
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
      subtitle: props.muted ? t`Muted` : t`On`,
      icon: props.muted ? VolumeXIcon : Volume2Icon,
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

function useGlobalMenuHeader(
  props: AppHeaderGlobalMenuViewProps
): Accessor<OverflowMenuHeader> {
  const { t } = useLingui();
  return createMemo(() => {
    const current = props.identity;
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

/**
 * The global account menu, presentational: the account face as trigger, a
 * header naming the person, and rows for Settings, Connectivity (with its
 * status), Account, Theme and Sound. It shows identity only — never a sign-in
 * state or a tier. `AppHeaderGlobalMenu` supplies identity and preferences.
 */
export function AppHeaderGlobalMenuView(
  props: AppHeaderGlobalMenuViewProps
): JSX.Element {
  const { t } = useLingui();
  const actions = useGlobalMenuActions(props);
  const header = useGlobalMenuHeader(props);
  const trigger = createMemo(() =>
    accountFace(props.identity, TRIGGER_AVATAR_SIZE)
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
