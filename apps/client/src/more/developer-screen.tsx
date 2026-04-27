import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { Box, MenuRow, ScreenBase } from '@gamezilla/lib/ui';
import { type Href, useRouter } from 'expo-router';

type DevHref =
  | '/todos'
  | '/ui'
  | '/more/patch-db'
  | '/more/db-client'
  | '/more/room'
  | '/more/client-config';

const ITEMS: readonly {
  key: string;
  href: DevHref;
  label: string;
  description: string;
}[] = [
  {
    key: 'todos',
    href: '/todos',
    label: 'Todos',
    description: 'Patch DB todo lists (demo)',
  },
  {
    key: 'ui',
    href: '/ui',
    label: 'UI Components',
    description: 'Shared UI explorer',
  },
  {
    key: 'patch-db',
    href: '/more/patch-db',
    label: 'Patch DB Playground',
    description: 'Sync simulation with server and clients',
  },
  {
    key: 'db-client',
    href: '/more/db-client',
    label: 'Patch DB Client',
    description: 'Browse entities, attributes, and patch history',
  },
  {
    key: 'room',
    href: '/more/room',
    label: 'Room Playground',
    description: 'Multi-peer tic-tac-toe simulator',
  },
  {
    key: 'client-config',
    href: '/more/client-config',
    label: 'Client config',
    description: 'Singleton clientConfig entity and server refresh',
  },
] as const;

export function DeveloperScreen() {
  const router = useRouter();
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      breadcrumbs={[
        { name: 'Spaces', onPress: nav('/') },
        { name: 'Settings', onPress: nav('/more') },
        {
          name: 'Developer',
          subtitle: 'Demos and internal tools',
        },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          {ITEMS.map((item) => (
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
