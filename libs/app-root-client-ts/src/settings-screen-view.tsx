/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import {
  ActivityIcon,
  CreditCardIcon,
  InfoIcon,
  PaintbrushIcon,
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
  /**
   * The group's label. Every settings group has one (the subs' sections
   * too), so the eye finds each group the same way.
   */
  readonly title: string;
  /** What the group is for, beside its rows on a desktop. */
  readonly description?: string | undefined;
  /** A note under the group's rows. */
  readonly footer?: string | undefined;
  readonly rows: readonly SettingsRow[];
};

export type SettingsScreenViewProps = {
  /** The chosen appearance, shown on the Appearance row. */
  readonly theme: ThemePreference;
  /** Whether in-app sound effects are muted. */
  readonly muted: boolean;
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
    title: t`Your account`,
    description: t`Sign-in and devices`,
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
 * The Work offline row's caption, short: what turning it on does, and what
 * is stopped while it is on. Multiplayer leads either way, and so does what
 * it means for a game with others (it disconnects), so turning it on never
 * reads like an ordinary preference.
 */
function useWorkOfflineCaption(
  props: SettingsScreenViewProps
): Accessor<string> {
  const { t } = useLingui();
  return () =>
    props.offline
      ? t`Multiplayer is disconnected and syncing is paused`
      : t`Disconnects multiplayer and pauses syncing`;
}

function usePreferencesGroup(
  props: SettingsScreenViewProps
): Accessor<SettingsGroup> {
  const { t } = useLingui();
  const themeValue = useThemeValue(props);
  return () => ({
    key: 'preferences',
    title: t`Preferences`,
    description: t`Look and sound`,
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
    ],
  });
}

/**
 * Working offline on its own, apart from look and sound: it is not a
 * preference but a choice that ends every game with others, so its group
 * says so under the switch.
 */
function useConnectionGroup(
  props: SettingsScreenViewProps
): Accessor<SettingsGroup> {
  const { t } = useLingui();
  const offlineCaption = useWorkOfflineCaption(props);
  return () => ({
    key: 'connection',
    title: t`Connection`,
    description: t`Playing with others and syncing`,
    footer: t`While you work offline, nobody can play with you: a game with others disconnects, and what you do waits on this device until you go back online.`,
    rows: [
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

/** Everyday groups lead; About and Troubleshooting follow the subs' sections. */
function useSettingsGroups(props: SettingsScreenViewProps): {
  readonly everyday: Accessor<readonly SettingsGroup[]>;
} {
  const account = useAccountGroup(props);
  const preferences = usePreferencesGroup(props);
  const connection = useConnectionGroup(props);
  return { everyday: () => [account(), preferences(), connection()] };
}

function SettingsGroupView(props: {
  readonly group: SettingsGroup;
  readonly onNavigate: (href: Href) => void;
}): JSX.Element {
  return (
    <MenuSection
      title={props.group.title}
      description={props.group.description}
      footer={props.group.footer}
    >
      <For each={props.group.rows}>
        {(row) => <SettingsRowItem row={row} onNavigate={props.onNavigate} />}
      </For>
    </MenuSection>
  );
}

/**
 * The App group: About, then Troubleshooting, a page of diagnostics
 * (connection, sync, client config, performance) for when something is not
 * working. Both open a page, like every other row with a right chevron.
 */
function AboutSection(props: SettingsScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuSection title={t`App`} description={t`Version and diagnostics`}>
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
      <SettingsRowItem
        row={{
          title: t`Troubleshooting`,
          caption: t`Connection, sync and diagnostics`,
          icon: ActivityIcon,
          href: '/more/troubleshooting',
          testid: Handles.settingsTroubleshooting,
        }}
        onNavigate={props.onNavigate}
      />
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
 * contribute, then About and Troubleshooting (a page of diagnostics:
 * connection, sync, client config and performance). `SettingsScreen` wires preferences, permissions and
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
        { name: <Trans>Profile</Trans>, href: '/profile' },
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
