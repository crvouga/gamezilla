import { useTheme } from '@gamezilla/shared/theme';
import { Box, Pressable, Text } from '@gamezilla/shared/ui';
import type {
  BottomTabBarProps,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';

/** Minimum tap height; same value on every platform. */
const TAB_BAR_MIN_ROW_HEIGHT = 52;

/** Expo Router adds `href`; RN types omit it. */
type ExpoTabOptions = BottomTabNavigationOptions & {
  href?: string | null;
};

/**
 * Fully custom tab bar using design-system primitives only (no React Navigation
 * tab bar UI).
 */
export function CustomTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'stretch',
        background: 'paper',
        borderTopWidth: 1,
        borderColor: 'border',
        paddingTop: 2,
        paddingBottom: insets.bottom,
      }}
    >
      {state.routes.map((route) => {
        const descriptor = descriptors[route.key];
        if (descriptor === undefined) {
          return null;
        }

        const options: ExpoTabOptions = descriptor.options as ExpoTabOptions;
        if (options.href === null) {
          return null;
        }

        const focusedRoute = state.routes[state.index];
        const isFocused =
          focusedRoute !== undefined && focusedRoute.key === route.key;
        const tint = isFocused
          ? theme.colors.tabIconSelected
          : theme.colors.tabIconDefault;
        const label =
          typeof options.tabBarLabel === 'function'
            ? (options.title ?? route.name)
            : (options.tabBarLabel ?? options.title ?? route.name);

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            if (route.params !== undefined) {
              navigation.navigate(route.name, route.params);
            } else {
              navigation.navigate(route.name);
            }
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const icon = options.tabBarIcon?.({
          focused: isFocused,
          color: tint,
          size: 24,
        });

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onPress();
            }}
            onLongPress={onLongPress}
            sx={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              minHeight: TAB_BAR_MIN_ROW_HEIGHT,
              py: 1,
            }}
          >
            {icon}
            <Text
              variant="caption"
              style={{
                color: tint,
                fontWeight: isFocused ? '600' : '500',
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </Box>
  );
}
