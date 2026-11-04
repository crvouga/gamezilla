/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import {
  ActivityIcon,
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
import { type Accessor, createSignal, For, type JSX, Show } from 'solid-js';
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
  /** A note under the group's rows. */
  readonly footer?: string | undefined;
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

/**
 * The Work offline row's caption: the mode the app is in now, then what the
 * switch would change. "Online" / "Offline" lead, so the row says where the
 * person stands before it says what the switch does.
 */
function useWorkOfflineCaption(
  props: SettingsScreenViewProps
): Accessor<string> {
  const { t } = useLingui();
  return () =>
    props.offline
      ? t`Offline. Nothing connects until you turn this off.`
      : t`Online. Turn on to stop every network connection.`;
}

function usePreferencesGroup(
  props: SettingsScreenViewProps
): Accessor<SettingsGroup> {
  const { t } = useLingui();
  const themeValue = useThemeValue(props);
  const offlineCaption = useWorkOfflineCaption(props);
  return () => ({
    key: 'preferences',
    title: t`Preferences`,
    rows: [
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
        title: t`Work offline`,
        caption: offlineCaption(),
        icon: props.offline ? WifiOffIcon : WifiIcon,
        toggle: {
          value: props.offline,
          onChange: props.onOfflineChange,
          label: t`Work offline`,
        },
        testid: Handles.settingsWorkOffline,
      },
    ],
  });
}

/** Diagnostics, behind the Troubleshooting disclosure: for when something is not working. */
function useTroubleshootingRows(
  props: SettingsScreenViewProps
): Accessor<readonly SettingsRow[]> {
  const { t } = useLingui();
  return () => [
    {
      title: t`Connection`,
      caption: t`Status, and what works offline`,
      icon: WifiIcon,
      href: '/more/server-status',
      testid: Handles.settingsConnection,
    },
    {
      title: t`Sync`,
      caption: t`Changes waiting to send`,
      icon: RefreshCwIcon,
      href: '/more/sync',
      testid: 'settings-sync',
    },
    {
      title: t`Client config`,
      caption: t`Settings from the server`,
      icon: SlidersHorizontalIcon,
      href: '/more/client-config',
      testid: 'settings-client-config',
    },
    {
      title: t`Performance`,
      caption: t`Frame rate and responsiveness`,
      value: props.perfEnabled ? t`On` : t`Off`,
      icon: GaugeIcon,
      href: '/more/performance',
      testid: 'settings-performance',
    },
  ];
}

/** Everyday groups lead; About and Troubleshooting follow the subs' sections. */
function useSettingsGroups(props: SettingsScreenViewProps): {
  readonly everyday: Accessor<readonly SettingsGroup[]>;
} {
  const account = useAccountGroup(props);
  const preferences = usePreferencesGroup(props);
  return { everyday: () => [account(), preferences()] };
}

function SettingsGroupView(props: {
  readonly group: SettingsGroup;
  readonly onNavigate: (href: Href) => void;
}): JSX.Element {
  return (
    <MenuSection title={props.group.title} footer={props.group.footer}>
      <For each={props.group.rows}>
        {(row) => <SettingsRowItem row={row} onNavigate={props.onNavigate} />}
      </For>
    </MenuSection>
  );
}

/**
 * About, then one Troubleshooting row, closed until it is opened: the
 * diagnostics (connection, sync, client config, performance) are one tap
 * away without taking the screen from everyday settings.
 */
function AboutSection(props: SettingsScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const troubleshooting = useTroubleshootingRows(props);
  const [open, setOpen] = createSignal(false);
  return (
    <MenuSection
      footer={
        open() ? t`Details to check when something isn't working.` : undefined
      }
    >
      <SettingsRowItem
        row={{
          title: t`About`,
          value: props.version,
          icon: InfoIcon,
          href: '/more/about',
          testid: Handles.settingsAbout,
        }}
        onNavigate={props.onNavigate}
      />
      <MenuRow
        title={t`Troubleshooting`}
        caption={t`Connection, sync and diagnostics`}
        leading={<ActivityIcon size={ROW_ICON_SIZE} color="icon" />}
        expanded={open()}
        onClick={() => setOpen((value) => !value)}
        dataSet={{ testid: Handles.settingsTroubleshooting }}
      />
      <Show when={open()}>
        <For each={troubleshooting()}>
          {(row) => <SettingsRowItem row={row} onNavigate={props.onNavigate} />}
        </For>
      </Show>
    </MenuSection>
  );
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
 * `/more`, presentational: the settings index — everyday account and
 * preference groups first, then whatever settings the composed subs
 * contribute, then About with a Troubleshooting disclosure (closed until
 * opened) over the diagnostics: connection, sync, client config and
 * performance. `SettingsScreen` wires preferences, permissions and
 * navigation.
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
      <For each={groups.everyday()}>
        {(group) => (
          <SettingsGroupView group={group} onNavigate={props.onNavigate} />
        )}
      </For>
      {props.subSettings}
      <AboutSection {...props} />
    </MenuScreen>
  );
}
