/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import {
  CreditCardIcon,
  GaugeIcon,
  InfoIcon,
  PaintbrushIcon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
  UserIcon,
  Volume2Icon,
  VolumeXIcon,
  WifiIcon,
  WifiOffIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Switch } from '@pkgs/ui-root-client-ts/switch';
import type { ThemePreference } from '@pkgs/ui-root-client-ts/theme-preference';
import type { Href } from '@pkgs/ui-root-shared-ts/href';
import { type Accessor, For, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';

const ROW_ICON_SIZE = 20;

type SettingsRow = {
  readonly title: string;
  readonly caption?: string | undefined;
  readonly value?: string | undefined;
  readonly icon: IconComponent;
  readonly href?: Href | undefined;
  readonly toggle?: {
    readonly value: boolean;
    readonly onChange: (next: boolean) => void;
    readonly label: string;
  };
  readonly testid?: string | undefined;
};

type SettingsGroup = {
  readonly key: string;
  readonly title: string;
  readonly rows: readonly SettingsRow[];
};

export type SettingsScreenViewProps = {
  /** The chosen appearance, shown on the Appearance row. */
  readonly theme: ThemePreference;
  /** Whether in-app sound effects are muted. */
  readonly muted: boolean;
  /** Whether the performance monitor is on. */
  readonly perfEnabled: boolean;
  /** Whether the person chose to work offline. */
  readonly offline: boolean;
  /** Whether the Billing row is offered (a permission decision). */
  readonly canViewBilling: boolean;
  /** The app version, shown on the About row. */
  readonly version: string;
  /** Settings sections the composed subs contribute, after the shell's own. */
  readonly subSettings?: JSX.Element;
  readonly onOfflineChange: (offline: boolean) => void;
  /** Open a settings sub-screen. */
  readonly onNavigate: (href: Href) => void;
};

function useThemeValue(props: SettingsScreenViewProps): Accessor<string> {
  const { t } = useLingui();
  return () => {
    const p = props.theme;
    if (p === 'light') return t`Light`;
    if (p === 'dark') return t`Dark`;
    return t`System`;
  };
}

function useAccountGroup(
  props: SettingsScreenViewProps
): Accessor<SettingsGroup> {
  const { t } = useLingui();
  return () => ({
    key: 'account',
    title: t`Account`,
    rows: [
      {
        title: t`Account`,
        caption: t`Sign-in methods, devices, sign out`,
        icon: UserIcon,
        href: '/more/account',
        testid: 'settings-account',
      },
      ...(props.canViewBilling
        ? [
            {
              title: t`Billing`,
              caption: t`Plan and subscription`,
              icon: CreditCardIcon,
              href: '/more/billing',
              testid: Handles.settingsBilling,
            },
          ]
        : []),
    ],
  });
}

function usePreferencesGroup(
  props: SettingsScreenViewProps
): Accessor<SettingsGroup> {
  const { t } = useLingui();
  const themeValue = useThemeValue(props);
  return () => ({
    key: 'preferences',
    title: t`Preferences`,
    rows: [
      {
        title: t`Work offline`,
        caption: t`Stop every network connection until you work online`,
        value: props.offline ? t`Offline` : t`Online`,
        icon: props.offline ? WifiOffIcon : WifiIcon,
        toggle: {
          value: props.offline,
          onChange: props.onOfflineChange,
          label: t`Work offline`,
        },
        testid: Handles.settingsWorkOffline,
      },
      {
        title: t`Appearance`,
        value: themeValue(),
        icon: PaintbrushIcon,
        href: '/more/theme',
        testid: Handles.settingsTheme,
      },
      {
        title: t`Sound`,
        value: props.muted ? t`Muted` : t`On`,
        icon: props.muted ? VolumeXIcon : Volume2Icon,
        href: '/more/sound',
        testid: Handles.settingsSound,
      },
      {
        title: t`Performance`,
        value: props.perfEnabled ? t`On` : t`Off`,
        icon: GaugeIcon,
        href: '/more/performance',
        testid: 'settings-performance',
      },
    ],
  });
}

function useStatusGroup(): Accessor<SettingsGroup> {
  const { t } = useLingui();
  return () => ({
    key: 'status',
    title: t`Status`,
    rows: [
      {
        title: t`Connection`,
        caption: t`Whether the app is connected, and what works without it`,
        icon: WifiIcon,
        href: '/more/server-status',
        testid: Handles.settingsConnection,
      },
      {
        title: t`Sync`,
        caption: t`Local database and sync state`,
        icon: RefreshCwIcon,
        href: '/more/sync',
        testid: 'settings-sync',
      },
      {
        title: t`Client config`,
        caption: t`Synced runtime configuration`,
        icon: SlidersHorizontalIcon,
        href: '/more/client-config',
        testid: 'settings-client-config',
      },
    ],
  });
}

function useAboutGroup(
  props: SettingsScreenViewProps
): Accessor<SettingsGroup> {
  const { t } = useLingui();
  return () => ({
    key: 'about',
    title: t`About`,
    rows: [
      {
        title: t`About`,
        value: props.version,
        icon: InfoIcon,
        href: '/more/about',
        testid: Handles.settingsAbout,
      },
    ],
  });
}

function useSettingsGroups(
  props: SettingsScreenViewProps
): Accessor<readonly SettingsGroup[]> {
  const account = useAccountGroup(props);
  const preferences = usePreferencesGroup(props);
  const status = useStatusGroup();
  const about = useAboutGroup(props);
  return () => [account(), preferences(), status(), about()];
}

function SettingsRowItem(props: {
  readonly row: SettingsRow;
  readonly onNavigate: (href: Href) => void;
}): JSX.Element {
  const onClick = (): (() => void) | undefined => {
    const href = props.row.href;
    return href === undefined ? undefined : () => props.onNavigate(href);
  };
  return (
    <MenuRow
      title={props.row.title}
      caption={props.row.caption}
      value={
        props.row.value !== undefined && props.row.value.length > 0
          ? props.row.value
          : undefined
      }
      leading={
        <Dynamic component={props.row.icon} size={ROW_ICON_SIZE} color="icon" />
      }
      trailing={
        props.row.toggle === undefined ? undefined : (
          <Switch
            value={props.row.toggle.value}
            onValueChange={props.row.toggle.onChange}
            aria-label={props.row.toggle.label}
            dataSet={{ testid: Handles.settingsWorkOfflineSwitch }}
          />
        )
      }
      onClick={onClick()}
      href={props.row.href}
      dataSet={
        props.row.testid === undefined ? {} : { testid: props.row.testid }
      }
    />
  );
}

/**
 * `/more`, presentational: the settings index — account, preferences, status
 * and about groups of rows opening the sub-screens, then whatever settings the
 * composed subs contribute. `SettingsScreen` wires preferences, permissions
 * and navigation.
 */
export function SettingsScreenView(
  props: SettingsScreenViewProps
): JSX.Element {
  const groups = useSettingsGroups(props);
  return (
    <MenuScreen
      screenId="more"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans> },
      ]}
    >
      <For each={groups()}>
        {(group) => (
          <MenuSection title={group.title}>
            <For each={group.rows}>
              {(row) => (
                <SettingsRowItem row={row} onNavigate={props.onNavigate} />
              )}
            </For>
          </MenuSection>
        )}
      </For>
      {props.subSettings}
    </MenuScreen>
  );
}
