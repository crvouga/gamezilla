import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { MenuList, MenuRow, ScreenBase } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { type Href, useRouter } from 'expo-router';

type MoreRow = {
  title: string;
  caption: string;
  href: Href;
};

function useMoreRows(): readonly MoreRow[] {
  const { t } = useLingui();
  return [
    {
      title: t`Account`,
      caption: t`Devices, sign-in methods, and sign out`,
      href: '/more/account' as Href,
    },
    {
      title: t`Appearance`,
      caption: t`Light, dark, or system theme`,
      href: '/more/theme',
    },
    {
      title: t`Connection`,
      caption: t`Network reachability and API server health`,
      href: '/more/server-status',
    },
    {
      title: t`UI Components`,
      caption: t`Shared UI explorer`,
      href: '/ui',
    },
    {
      title: t`Sync status`,
      caption: t`PowerSync connection and sync state`,
      href: '/more/sync',
    },
    {
      title: t`Client config`,
      caption: t`Singleton clientConfig entity and server refresh`,
      href: '/more/client-config',
    },
    {
      title: t`About`,
      caption: t`App version, build, commit hash, and commit date`,
      href: '/more/about' as Href,
    },
  ];
}

export function SettingsScreen() {
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const rows = useMoreRows();

  return (
    <ScreenBase
      screenId="settings"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans> },
      ]}
      content={({ sx }) => (
        <MenuList style={sx}>
          {rows.map((row) => (
            <MenuRow
              key={row.title}
              title={row.title}
              caption={row.caption}
              onPress={() => router.push(row.href)}
            />
          ))}
        </MenuList>
      )}
    />
  );
}
