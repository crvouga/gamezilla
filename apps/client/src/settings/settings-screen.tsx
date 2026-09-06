import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Trans, useLingui } from '@lingui/react/macro';
import { useSoundsPreference } from '@pkgs/sounds';
import {
  Box,
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
  useTheme,
  useThemePreference,
  Volume2Icon,
  VolumeXIcon,
  WifiIcon,
} from '@pkgs/ui-rn';
import Constants from 'expo-constants';
import type { ReactNode } from 'react';

import { usePerfHudPreference } from '../perf/perf-hud-preference';

const ROW_ICON_SIZE = 20;

type SettingsRow = {
  readonly title: string;
  readonly caption?: string;
  readonly value?: string;
  readonly icon: IconComponent;
  readonly href: Href;
};

type SettingsGroup = {
  readonly key: string;
  readonly title: string;
  readonly rows: readonly SettingsRow[];
};

function useThemeValue(): string {
  const { t } = useLingui();
  const { preference } = useThemePreference();
  if (preference === 'light') return t`Light`;
  if (preference === 'dark') return t`Dark`;
  return t`System`;
}

function useSettingsGroups(): readonly SettingsGroup[] {
  const { t } = useLingui();
  const themeValue = useThemeValue();
  const { muted } = useSoundsPreference();
  const { enabled: perfEnabled } = usePerfHudPreference();
  const appVersion = Constants.expoConfig?.version ?? '';
  return [
    {
      key: 'account',
      title: t`Account`,
      rows: [
        {
          title: t`Account`,
          caption: t`Sign-in methods, devices, sign out`,
          icon: UserIcon,
          href: '/more/account' as Href,
        },
      ],
    },
    {
      key: 'preferences',
      title: t`Preferences`,
      rows: [
        {
          title: t`Appearance`,
          value: themeValue,
          icon: PaintbrushIcon,
          href: '/more/theme',
        },
        {
          title: t`Sound`,
          value: muted ? t`Muted` : t`On`,
          icon: muted ? VolumeXIcon : Volume2Icon,
          href: '/more/sound',
        },
        {
          title: t`Performance`,
          value: perfEnabled ? t`On` : t`Off`,
          icon: GaugeIcon,
          href: '/more/performance',
        },
      ],
    },
    {
      key: 'status',
      title: t`Status`,
      rows: [
        {
          title: t`Connection`,
          caption: t`Network reachability and server health`,
          icon: WifiIcon,
          href: '/more/server-status',
        },
        {
          title: t`Sync`,
          caption: t`Local database and sync state`,
          icon: RefreshCwIcon,
          href: '/more/sync',
        },
        {
          title: t`Client config`,
          caption: t`Synced runtime configuration`,
          icon: SlidersHorizontalIcon,
          href: '/more/client-config',
        },
      ],
    },
    {
      key: 'about',
      title: t`About`,
      rows: [
        {
          title: t`About`,
          value: appVersion,
          icon: InfoIcon,
          href: '/more/about' as Href,
        },
        {
          title: t`UI components`,
          caption: t`Design system explorer`,
          icon: SquareStackIcon,
          href: '/ui',
        },
      ],
    },
  ];
}

function SettingsRowItem({ row }: { readonly row: SettingsRow }): ReactNode {
  const router = useRouter();
  const theme = useTheme();
  const Icon = row.icon;
  return (
    <MenuRow
      title={row.title}
      {...(row.caption !== undefined ? { caption: row.caption } : {})}
      {...(row.value !== undefined && row.value.length > 0
        ? { value: row.value }
        : {})}
      leading={<Icon size={ROW_ICON_SIZE} color={theme.colors.icon} />}
      onPress={() => router.push(row.href)}
    />
  );
}

export function SettingsScreen() {
  const nav = useBreadcrumbNav();
  const groups = useSettingsGroups();

  return (
    <ScreenBase
      screenId="settings"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans> },
      ]}
      scroll
      content={({ sx }) => (
        <Box sx={[sx, { gap: 5 }]}>
          {groups.map((group) => (
            <MenuSection key={group.key} title={group.title}>
              {group.rows.map((row) => (
                <SettingsRowItem key={row.title} row={row} />
              ))}
            </MenuSection>
          ))}
        </Box>
      )}
    />
  );
}
