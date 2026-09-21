/** @jsxImportSource solid-js */
/**
 * `/more` — settings index: account, preferences, status and about groups of
 * `MenuRow`s linking to the sub-screens.
 */

import { useClientConfig } from '@libs/client-config/public/use-client-config';
import { useAccessLabel } from '@libs/permissions/public/use-access-label';
import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useSoundsPreference } from '@pkgs/sounds/solid';
import {
  CreditCardIcon,
  GaugeIcon,
  type Href,
  type IconComponent,
  InfoIcon,
  MenuRow,
  MenuSection,
  PaintbrushIcon,
  RefreshCwIcon,
  ScreenBase,
  SlidersHorizontalIcon,
  SquareStackIcon,
  UserIcon,
  useRouter,
  useThemePreference,
  Volume2Icon,
  VolumeXIcon,
  WifiIcon,
} from '@pkgs/ui';
import { type Accessor, For, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import { APP_VERSION } from '../../config/app-metadata';
import { useLocalIdentity } from '../../shell/identity/identity-context';
import { usePerfHudPreference } from '../../shell/perf/perf-hud-preference';

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
  const { isSignedIn } = useLocalIdentity();
  const config = useClientConfig();
  const accessLabel = useAccessLabel();
  return () => ({
    key: 'account',
    title: t`Account`,
    rows: [
      {
        title: t`Account`,
        caption: t`Sign-in methods, devices, sign out`,
        value: isSignedIn() ? t`Signed in` : t`Guest`,
        icon: UserIcon,
        href: '/more/account',
        testid: 'settings-account',
      },
      ...(config.config().billing_enabled
        ? [
            {
              title: t`Billing`,
              caption: t`Plan and subscription`,
              value: accessLabel(),
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
        testid: 'settings-theme',
      },
      {
        title: t`Sound`,
        value: muted() ? t`Muted` : t`On`,
        icon: muted() ? VolumeXIcon : Volume2Icon,
        href: '/more/sound',
        testid: 'settings-sound',
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
        testid: 'settings-about',
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
