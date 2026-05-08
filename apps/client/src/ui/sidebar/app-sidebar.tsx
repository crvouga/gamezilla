import { Box, IconSymbol, Pressable, Text, useTheme } from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SidebarAccountMenu } from '@gamezilla/client/ui/sidebar/sidebar-account-menu';

type NavItem = {
  href: '/' | '/profile';
  label: string;
  icon: 'house.fill' | 'person.fill';
};

function useNavItems(): readonly NavItem[] {
  const { t } = useLingui();
  return [
    { href: '/', label: t`Spaces`, icon: 'house.fill' },
    { href: '/profile', label: t`Profile`, icon: 'person.fill' },
  ];
}

function isItemActive(item: NavItem, normalized: string): boolean {
  if (item.href === '/profile') return normalized === '/profile';
  return normalized === '/' || normalized === '';
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        router.push(item.href);
      }}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        py: 3,
        px: 3,
        borderRadius: 12,
        background: active ? 'surface' : 'transparent',
      }}
    >
      <IconSymbol
        name={item.icon}
        size={22}
        color={active ? theme.colors.tabIconSelected : theme.colors.icon}
      />
      <Text
        variant="bodyBold"
        sx={{
          color: active ? 'text' : 'textSecondary',
        }}
        label={item.label}
      />
    </Pressable>
  );
}

function NavSection({ normalized }: { normalized: string }) {
  const items = useNavItems();
  return (
    <Box sx={{ py: 4, px: 3, gap: 1 }}>
      <Text
        variant="label"
        sx={{ color: 'textSecondary', mb: 2, letterSpacing: 0.5 }}
        label={<Trans>Gamezilla</Trans>}
      />
      {items.map((item) => (
        <NavRow
          key={item.href}
          item={item}
          active={isItemActive(item, normalized)}
        />
      ))}
    </Box>
  );
}

export function AppSidebar() {
  const theme = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const path = pathname.split('?')[0]?.replace(/\/$/, '') ?? '';
  const normalized = path === '' ? '/' : path;

  const width = theme.breakpoint === 'desktop' ? 240 : 200;

  return (
    <Box
      sx={{
        width,
        minWidth: width,
        maxWidth: width,
        flexBasis: width,
        flexGrow: 0,
        flexShrink: 0,
        alignSelf: 'stretch',
        flexDirection: 'column',
        background: 'surface',
        borderRightWidth: 1,
        borderColor: 'border',
        paddingTop: insets.top,
      }}
    >
      <NavSection normalized={normalized} />
      <Box sx={{ flex: 1 }} />
      <Box
        sx={{
          borderTopWidth: 1,
          borderColor: 'border',
          paddingHorizontal: 3,
          paddingTop: 2,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 2,
        }}
      >
        <SidebarAccountMenu />
      </Box>
    </Box>
  );
}
