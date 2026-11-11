/** @jsxImportSource solid-js */

import type { GlobalMenuIdentity } from '@libs/app-env-client-ts/global-menu-identity-context';
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
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import type { StatusDotStatus } from '@pkgs/ui-root-client-ts/status-dot';
import { StatusDot } from '@pkgs/ui-root-client-ts/status-dot';
import { Text } from '@pkgs/ui-root-client-ts/text';
import type { ThemePreference } from '@pkgs/ui-root-client-ts/theme-preference';
import { type Accessor, createMemo, type JSX, Show } from 'solid-js';

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
  /**
   * The wide sidebar's foot: the person's name beside their face, so the
   * trigger reads as who is signed in rather than a second Profile row.
   * The top bars keep the face alone.
   */
  readonly showName?: boolean | undefined;
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

/** The name shown beside the face, when asked for and known. */
function shownName(props: AppHeaderGlobalMenuViewProps): string | null {
  const name = props.identity.usernameLabel;
  return props.showName === true && name !== null && name.length > 0
    ? name
    : null;
}

/** The trigger: the face, with the person's name beside it when shown. */
function MenuTrigger(props: {
  readonly face: JSX.Element;
  readonly name: string | null;
}): JSX.Element {
  return (
    <Show when={props.name} keyed fallback={props.face}>
      {(name) => (
        <StackHorizontal align="center" gap="sm" shrink>
          {props.face}
          <Text variant="label" tone="secondary" lines={1}>
            {name}
          </Text>
        </StackHorizontal>
      )}
    </Show>
  );
}

/**
 * The global account menu, presentational: the account face as trigger
 * (with the person's name beside it in the wide sidebar), a header naming
 * the person, and rows for Settings, Connectivity (with its
 * status), Account, Theme and Sound. It shows identity only — never a sign-in
 * state or a tier. `AppHeaderGlobalMenu` supplies identity and preferences.
 */
export function AppHeaderGlobalMenuView(
  props: AppHeaderGlobalMenuViewProps
): JSX.Element {
  const { t } = useLingui();
  const actions = useGlobalMenuActions(props);
  const header = useGlobalMenuHeader(props);
  const face = createMemo(() =>
    accountFace(props.identity, TRIGGER_AVATAR_SIZE)
  );
  const name = (): string | null => shownName(props);
  const trigger = createMemo(() => <MenuTrigger face={face()} name={name()} />);
  // A shown name is part of what the trigger is called (WCAG 2.5.3).
  const label = (): string => {
    const shown = name();
    return shown === null ? t`Account menu` : t`${shown}, account menu`;
  };
  // The sidebar's foot opens upward, from the trigger's left edge; the top
  // bars open downward, from their right edge.
  const placement = (): 'top-start' | 'bottom-end' =>
    props.showName === true ? 'top-start' : 'bottom-end';
  return (
    <OverflowMenuButton
      placement={placement()}
      tooltipPlacement={placement()}
      actions={actions()}
      header={header()}
      trigger={trigger()}
      aria-label={label()}
      dataSet={{ testid: Handles.statusCurrentUser }}
    />
  );
}
