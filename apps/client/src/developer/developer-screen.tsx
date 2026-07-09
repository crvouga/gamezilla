import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Box, MenuRow, ScreenBase } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { type Href, useRouter } from 'expo-router';

type DevHref = '/ui' | '/more/sync' | '/more/room' | '/more/client-config';

type DevItem = {
  key: string;
  href: DevHref;
  label: string;
  description: string;
};

function useDevItems(): readonly DevItem[] {
  const { t } = useLingui();
  return [
    {
      key: 'ui',
      href: '/ui',
      label: t`UI Components`,
      description: t`Shared UI explorer`,
    },
    {
      key: 'sync',
      href: '/more/sync',
      label: t`Sync status`,
      description: t`PowerSync connection and sync state`,
    },
    {
      key: 'room',
      href: '/more/room',
      label: t`Room Playground`,
      description: t`Multi-peer tic-tac-toe simulator`,
    },
    {
      key: 'client-config',
      href: '/more/client-config',
      label: t`Client config`,
      description: t`Singleton clientConfig entity and server refresh`,
    },
  ];
}

export function DeveloperScreen() {
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const items = useDevItems();

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Developer</Trans> },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          {items.map((item) => (
            <MenuRow
              key={item.key}
              title={item.label}
              caption={item.description}
              onPress={() => router.push(item.href as Href)}
            />
          ))}
        </Box>
      )}
    />
  );
}
