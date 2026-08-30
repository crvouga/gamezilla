import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useTheme } from './theme-context';

export function useStackProps(): {
  screenOptions: NativeStackNavigationOptions;
} {
  const theme = useTheme();
  return {
    screenOptions: {
      headerShown: false,
      contentStyle: { backgroundColor: theme.colors.background },
      animation: 'none',
    },
  };
}

/**
 * Tint colors + scene background for the bottom-tabs navigator.
 * Inactive tabs freeze on blur; tabs mount eagerly (no route lazy).
 */
export function useTabsProps(): {
  screenOptions: BottomTabNavigationOptions;
} {
  const theme = useTheme();
  return {
    screenOptions: {
      headerShown: false,
      lazy: false,
      freezeOnBlur: true,
      tabBarActiveTintColor: theme.colors.tint,
      tabBarInactiveTintColor: theme.colors.tabIconDefault,
      tabBarLabelPosition: 'below-icon',
      tabBarLabelStyle: { fontSize: 13 },
      sceneStyle: { backgroundColor: theme.colors.background },
    },
  };
}
