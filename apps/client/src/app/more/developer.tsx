import {
  Box,
  IconSymbol,
  Pressable,
  ScreenBase,
  Text,
  useTheme,
} from '@gamezilla/lib/ui';
import { useRouter } from 'expo-router';

import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';

type DevHref =
  | '/todos'
  | '/ui'
  | '/more/patch-db'
  | '/more/db-client'
  | '/more/peer-store'
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
    key: 'peer-store',
    href: '/more/peer-store',
    label: 'Peer Store Playground',
    description: 'Multi-peer tic-tac-toe simulator',
  },
  {
    key: 'client-config',
    href: '/more/client-config',
    label: 'Client config',
    description: 'Singleton clientConfig entity and server refresh',
  },
] as const;

export default function DeveloperScreen() {
  const router = useRouter();
  const theme = useTheme();
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
            <Pressable key={item.key} onPress={() => router.push(item.href)}>
              <Box
                sx={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  py: 3,
                  gap: 3,
                }}
              >
                <Box sx={{ flex: 1, gap: 1 }}>
                  <Text variant="bodyBold" label={item.label} />
                  <Text variant="caption" label={item.description} />
                </Box>
                <IconSymbol
                  name="chevron.right"
                  size={20}
                  color={theme.colors.icon}
                />
              </Box>
            </Pressable>
          ))}
        </Box>
      )}
    />
  );
}
