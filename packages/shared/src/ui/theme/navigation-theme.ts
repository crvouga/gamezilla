/**
 * Build a React Navigation theme object from design-system color tokens.
 */

import {
  DarkTheme,
  DefaultTheme,
  type Theme as NavigationTheme,
} from '@react-navigation/native';

import type { ColorScheme, ColorTokens } from './colors';

/** React Navigation theme plus tab bar tokens from {@link ColorTokens}. */
export type AppNavigationTheme = NavigationTheme & {
  colors: NavigationTheme['colors'] & {
    tabIconDefault: string;
    tabIconSelected: string;
  };
};

export function reactNavigationThemeFromTokens(
  colorScheme: ColorScheme,
  colors: ColorTokens
): AppNavigationTheme {
  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.tint,
      background: colors.paper,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.tint,
      tabIconDefault: colors.tabIconDefault,
      tabIconSelected: colors.tabIconSelected,
    },
    dark: colorScheme === 'dark',
  };
}
