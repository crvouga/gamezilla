import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Box, MenuRow, ScreenBase } from '@pkgs/ui';
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
      title: t`User`,
      caption: t`Devices and read-only sign-in provider info`,
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
      title: t`Server writes`,
      caption: t`Patch DB sync pushes and why they failed`,
      href: '/more/patch-db-server-writes' as Href,
    },
    {
      title: t`Developer`,
      caption: t`Todos, UI explorer, Patch DB and Room playgrounds`,
      href: '/more/developer',
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
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans> },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          {rows.map((row) => (
            <MenuRow
              key={row.title}
              title={row.title}
              caption={row.caption}
              onPress={() => router.push(row.href)}
            />
          ))}
        </Box>
      )}
    />
  );
}
