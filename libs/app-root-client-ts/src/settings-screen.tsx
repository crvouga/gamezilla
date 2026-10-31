/** @jsxImportSource solid-js */
/**
 * `/more` — settings index: account, preferences, status and about groups of
 * `MenuRow`s linking to the sub-screens.
 */

import { APP_VERSION } from '@libs/app-root-shared-ts/app-metadata';
import { useCan } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useSoundsPreference } from '@pkgs/sounds-client-ts/solid';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
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
import { useThemePreference } from '@pkgs/ui-root-client-ts/theme-preference';
import type { Href } from '@pkgs/ui-root-shared-ts/href';
import { type Accessor, For, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useAppSubs } from './app-subs-context';
import { useOfflinePreference } from './offline-preference';
import { usePerfHudPreference } from './perf-hud-preference';

const ROW_ICON_SIZE = 20;

type SettingsRow = {
  readonly title: string;
  readonly caption?: string | undefined;
  readonly value?: string | undefined;
  readonly icon: IconComponent;
  readonly href?: Href | undefined;
  readonly toggle?: {
    readonly value: Accessor<boolean>;
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

function useThemeValue(): Accessor<string> {
  const { t } = useLingui();
  const { preference } = useThemePreference();
  return () => {
    const p = preference();
    if (p === 'light') return t`Light`;
    if (p === 'dark') return t`Dark`;
    return t`System`;
  };
}

function useAccountGroup(): Accessor<SettingsGroup> {
  const { t } = useLingui();
  const canViewBilling = useCan(PERMISSION.billingView);
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
      ...(canViewBilling()
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

function usePreferencesGroup(): Accessor<SettingsGroup> {
  const { t } = useLingui();
  const themeValue = useThemeValue();
  const { muted } = useSoundsPreference();
  const { enabled: perfEnabled } = usePerfHudPreference();
  const { offline, setOffline } = useOfflinePreference();
  return () => ({
    key: 'preferences',
    title: t`Preferences`,
    rows: [
      {
        title: t`Work offline`,
        caption: t`Stop every network connection until you work online`,
        value: offline() ? t`Offline` : t`Online`,
        icon: offline() ? WifiOffIcon : WifiIcon,
        toggle: {
          value: offline,
          onChange: setOffline,
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
        value: muted() ? t`Muted` : t`On`,
        icon: muted() ? VolumeXIcon : Volume2Icon,
        href: '/more/sound',
        testid: Handles.settingsSound,
      },
      {
        title: t`Performance`,
        value: perfEnabled() ? t`On` : t`Off`,
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

function useAboutGroup(): Accessor<SettingsGroup> {
  const { t } = useLingui();
  return () => ({
    key: 'about',
    title: t`About`,
    rows: [
      {
        title: t`About`,
        value: APP_VERSION,
        icon: InfoIcon,
        href: '/more/about',
        testid: Handles.settingsAbout,
      },
    ],
  });
}

function useSettingsGroups(): Accessor<readonly SettingsGroup[]> {
  const account = useAccountGroup();
  const preferences = usePreferencesGroup();
  const status = useStatusGroup();
  const about = useAboutGroup();
  return () => [account(), preferences(), status(), about()];
}

function SettingsRowItem(props: { readonly row: SettingsRow }): JSX.Element {
  const router = useRouter();
  const onClick = (): (() => void) | undefined => {
    const href = props.row.href;
    return href === undefined ? undefined : () => router.push(href);
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
            value={props.row.toggle.value()}
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

export function SettingsScreen(): JSX.Element {
  const groups = useSettingsGroups();
  const subs = useAppSubs();
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
              {(row) => <SettingsRowItem row={row} />}
            </For>
          </MenuSection>
        )}
      </For>
      <For each={subs.settings}>{(Settings) => <Settings />}</For>
    </MenuScreen>
  );
}
