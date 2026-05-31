import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Box, MenuRow, ScreenBase } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { type Href, useRouter } from 'expo-router';

type DevHref =
  | '/todos'
  | '/ui'
  | '/more/patch-db'
  | '/more/patch-db-client'
  | '/more/patch-db-server-writes'
  | '/more/room'
  | '/more/client-config';

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
      key: 'todos',
      href: '/todos',
      label: t`Todos`,
      description: t`Patch DB todo lists (demo)`,
    },
    {
      key: 'ui',
      href: '/ui',
      label: t`UI Components`,
      description: t`Shared UI explorer`,
    },
    {
      key: 'patch-db',
      href: '/more/patch-db',
      label: t`Patch DB Playground`,
      description: t`Sync simulation with server and clients`,
    },
    {
      key: 'patch-db-client',
      href: '/more/patch-db-client',
      label: t`Patch DB Client`,
      description: t`Browse entities, attributes, and patch history`,
    },
    {
      key: 'patch-db-server-writes',
      href: '/more/patch-db-server-writes',
      label: t`Patch DB Server Writes`,
      description: t`Live log of sync pushes with failure details`,
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
