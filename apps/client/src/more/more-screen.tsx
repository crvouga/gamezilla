import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { Box, MenuRow, ScreenBase } from '@gamezilla/lib/ui';
import { type Href, useRouter } from 'expo-router';

type MoreRow = {
  title: string;
  caption: string;
  href: Href;
};

const MORE_ROWS: MoreRow[] = [
  {
    title: 'Appearance',
    caption: 'Light, dark, or system theme',
    href: '/more/theme',
  },
  {
    title: 'Connection',
    caption: 'Network reachability and API server health',
    href: '/more/server-status',
  },
  {
    title: 'Developer',
    caption: 'Todos, UI explorer, Patch DB and Room playgrounds',
    href: '/more/developer',
  },
  {
    title: 'About',
    caption: 'App version, build, and commit hash',
    href: '/more/about' as Href,
  },
];

export function MoreScreen() {
  const router = useRouter();
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      breadcrumbs={[
        { name: 'Spaces', onPress: nav('/') },
        {
          name: 'Settings',
          subtitle: 'App preferences and tools',
        },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          {MORE_ROWS.map((row) => (
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
