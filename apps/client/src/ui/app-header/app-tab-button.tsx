import {
  Box,
  IconSymbol,
  Pressable,
  Text,
  useTheme,
  type IconSymbolName,
} from '@pkgs/ui';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

export type AppTabButtonProps = {
  href: '/' | '/profile';
  label: string;
  icon: IconSymbolName;
  active: boolean;
};

const TAB_BUTTON_WIDTH = 96;
const TAB_BUTTON_HEIGHT = 56;
const ACTIVE_INDICATOR_HEIGHT = 3;

/**
 * Facebook-style header tab button. Icon + label centered, with a bottom
 * indicator stripe on the active route. Navigation goes through
 * `router.push` (the route stays mounted via expo-router `<Tabs>`).
 */
export function AppTabButton({
  href,
  label,
  icon,
  active,
}: AppTabButtonProps): ReactNode {
  const router = useRouter();
  const theme = useTheme();
  const tint = active ? theme.colors.tint : theme.colors.icon;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={() => router.push(href)}
      sx={{
        width: TAB_BUTTON_WIDTH,
        height: TAB_BUTTON_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
      }}
    >
      <IconSymbol name={icon} size={22} color={tint} />
      <Text
        variant="caption"
        sx={{ color: active ? 'tint' : 'textSecondary' }}
        label={label}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: ACTIVE_INDICATOR_HEIGHT,
          borderTopLeftRadius: ACTIVE_INDICATOR_HEIGHT,
          borderTopRightRadius: ACTIVE_INDICATOR_HEIGHT,
          background: active ? 'tint' : 'transparent',
        }}
      />
    </Pressable>
  );
}
