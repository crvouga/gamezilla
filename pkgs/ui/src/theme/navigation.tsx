import type { Stack, Tabs } from 'expo-router';
import { useTheme } from './theme-context';

export function useStackProps(): Parameters<typeof Stack>[0] {
  const theme = useTheme();
  return {
    screenOptions: {
      headerShown: false,
      contentStyle: { backgroundColor: theme.colors.background },
    },
  };
}

/**
 * Tint colors + scene background for the expo-router `Tabs` navigator.
 */
export function useTabsProps(): Parameters<typeof Tabs>[0] {
  const theme = useTheme();
  return {
    screenOptions: {
      headerShown: false,
      tabBarActiveTintColor: theme.colors.tint,
      tabBarInactiveTintColor: theme.colors.tabIconDefault,
      tabBarLabelPosition: 'below-icon',
      tabBarLabelStyle: { fontSize: 13 },
      sceneStyle: { backgroundColor: theme.colors.background },
    },
  };
}
