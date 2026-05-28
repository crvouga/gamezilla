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
 * Visibility is controlled by the caller via the `tabBar` slot (returning
 * `null` for breakpoints that re-host the bar elsewhere), so this hook
 * doesn't take a `hidden` flag.
 */
export function useTabsProps(): Parameters<typeof Tabs>[0] {
  const theme = useTheme();
  return {
    screenOptions: {
      headerShown: false,
      // Use the brand `tint` (blue in both light + dark) for the active
      // tab so the active state always reads as "selected = blue".
      // `tabIconSelected` collapses to white in dark mode and would
      // lose the brand cue on the desktop header.
      tabBarActiveTintColor: theme.colors.tint,
      tabBarInactiveTintColor: theme.colors.tabIconDefault,
      // Always stack icon over label. Without this, `BottomTabBar`
      // auto-switches to a beside-icon layout at >= 768pt -- i.e. when
      // the bar is re-hosted inside the desktop screen header -- which
      // makes the two breakpoints look different.
      tabBarLabelPosition: 'below-icon',
      // React Navigation defaults `below-icon` labels to fontSize 10
      // (iOS UIKit pre-Dynamic-Type sizing). That reads as ellipsis-dots
      // on desktop and is too small to be comfortable on mobile too.
      tabBarLabelStyle: { fontSize: 13 },
      sceneStyle: { backgroundColor: theme.colors.background },
    },
  };
}
