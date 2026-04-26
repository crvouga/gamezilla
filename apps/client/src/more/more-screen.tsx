import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import {
  Box,
  IconSymbol,
  Pressable,
  ScreenBase,
  Text,
  useTheme,
} from '@gamezilla/lib/ui';
import { type Href, useRouter } from 'expo-router';

type MoreRowProps = {
  title: string;
  caption: string;
  href: Href;
};

function MoreRow({ title, caption, href }: MoreRowProps) {
  const router = useRouter();
  const theme = useTheme();
  return (
    <Pressable onPress={() => router.push(href)}>
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          py: 3,
          gap: 3,
        }}
      >
        <Box sx={{ flex: 1, gap: 1 }}>
          <Text variant="bodyBold" label={title} />
          <Text variant="caption" label={caption} />
        </Box>
        <IconSymbol
          name="chevron.right"
          size={20}
          color={theme.colors.icon}
        />
      </Box>
    </Pressable>
  );
}

const MORE_ROWS: MoreRowProps[] = [
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
    caption: 'Todos, UI explorer, Patch DB and Peer Store playgrounds',
    href: '/more/developer',
  },
  {
    title: 'About',
    caption: 'App version, build, and commit hash',
    href: '/more/about' as Href,
  },
];

export function MoreScreen() {
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
            <MoreRow key={row.title} {...row} />
          ))}
        </Box>
      )}
    />
  );
}
