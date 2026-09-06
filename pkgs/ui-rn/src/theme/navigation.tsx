import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import { releaseWebFocus } from '../web/release-web-focus';
import { useTheme } from './theme-context';

const webScreenListeners = {
  tabPress: () => releaseWebFocus(),
  blur: () => releaseWebFocus(),
} as const;

export function useStackProps(): {
  screenOptions: NativeStackNavigationOptions;
  screenListeners?: { blur: () => void };
} {
  const theme = useTheme();
  return {
    screenOptions: {
      headerShown: false,
      contentStyle: { backgroundColor: theme.colors.background },
      animation: 'none',
    },
    ...(Platform.OS === 'web'
      ? { screenListeners: { blur: () => releaseWebFocus() } }
      : {}),
  };
}

/**
 * Tint colors + scene background for the bottom-tabs navigator.
 * Inactive tabs freeze on blur; tabs mount eagerly (no route lazy).
 */
export function useTabsProps(): {
  screenOptions: BottomTabNavigationOptions;
  screenListeners?: typeof webScreenListeners;
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
    ...(Platform.OS === 'web' ? { screenListeners: webScreenListeners } : {}),
  };
}
