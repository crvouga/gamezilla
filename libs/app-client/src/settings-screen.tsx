/** @jsxImportSource solid-js */
/**
 * `/more` — settings index: account, preferences, status and about groups of
 * `MenuRow`s linking to the sub-screens.
 */

import { APP_VERSION } from '@libs/app-shared/app-metadata';
import { useCan } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useSoundsPreference } from '@pkgs/sounds-client/solid';
import { useRouter } from '@pkgs/ui-client/app-router';
import type { IconComponent } from '@pkgs/ui-client/create-icon';
import {
  CreditCardIcon,
  GaugeIcon,
  InfoIcon,
  PaintbrushIcon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
  SquareStackIcon,
  UserIcon,
  Volume2Icon,
  VolumeXIcon,
  WifiIcon,
} from '@pkgs/ui-client/icons';
import { MenuRow } from '@pkgs/ui-client/menu-row';
import { MenuSection } from '@pkgs/ui-client/menu-section';
import { ScreenBase } from '@pkgs/ui-client/screen-base';
import { useThemePreference } from '@pkgs/ui-client/theme-preference';
import type { Href } from '@pkgs/ui-shared/href';
import { type Accessor, For, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { usePerfHudPreference } from './perf-hud-preference';

const ROW_ICON_SIZE = 20;

type SettingsRow = {
  readonly title: string;
  readonly caption?: string | undefined;
  readonly value?: string | undefined;
  readonly icon: IconComponent;
  readonly href: Href;
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
        caption: t`Network reachability and server health`,
        icon: WifiIcon,
        href: '/more/server-status',
        testid: 'settings-server-status',
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
      {
        title: t`UI components`,
        caption: t`Design system explorer`,
        icon: SquareStackIcon,
        href: '/ui',
        testid: 'settings-ui-explorer',
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
      onClick={() => router.push(props.row.href)}
      dataSet={
        props.row.testid === undefined ? {} : { testid: props.row.testid }
      }
    />
  );
}

export function SettingsScreen(): JSX.Element {
  const groups = useSettingsGroups();
  return (
    <ScreenBase
      screenId="more"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans> },
      ]}
      scroll
      content={({ bodyClass }) => (
        <div class={`box ${bodyClass} gap-5`}>
          <For each={groups()}>
            {(group) => (
              <MenuSection title={group.title}>
                <For each={group.rows}>
                  {(row) => <SettingsRowItem row={row} />}
                </For>
              </MenuSection>
            )}
          </For>
        </div>
      )}
    />
  );
}
