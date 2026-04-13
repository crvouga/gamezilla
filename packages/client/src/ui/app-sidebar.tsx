import { Link, usePathname } from 'expo-router';
import {
  Box,
  IconSymbol,
  Pressable,
  Text,
} from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavItem = {
  href: '/' | '/profile';
  label: string;
  icon: 'house.fill' | 'person.fill';
};

const ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Spaces', icon: 'house.fill' },
  { href: '/profile', label: 'Profile', icon: 'person.fill' },
];

export function AppSidebar() {
  const theme = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const path =
    pathname.split('?')[0]?.replace(/\/$/, '') ?? '';
  const normalized = path === '' ? '/' : path;

  const width =
    theme.breakpoint === 'desktop' ? 240 : 200;

  return (
    <Box
      sx={{
        width,
        flexShrink: 0,
        background: 'paper',
        borderRightWidth: 1,
        borderColor: 'border',
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <Box sx={{ py: 4, px: 3, gap: 1 }}>
        <Text
          variant="label"
          sx={{ color: 'textSecondary', mb: 2, letterSpacing: 0.5 }}
        >
          Gamezilla
        </Text>
        {ITEMS.map((item) => {
          const active =
            item.href === '/profile'
              ? normalized === '/profile'
              : normalized === '/' || normalized === '';
          return (
            <Link key={item.href} href={item.href} asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                sx={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  py: 3,
                  px: 3,
                  borderRadius: 12,
                  background: active ? 'surface' : 'paper',
                }}
              >
                <IconSymbol
                  name={item.icon}
                  size={22}
                  color={
                    active ? theme.colors.tabIconSelected : theme.colors.icon
                  }
                />
                <Text
                  variant="bodyBold"
                  sx={{
                    color: active ? 'text' : 'textSecondary',
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            </Link>
          );
        })}
      </Box>
    </Box>
  );
}
