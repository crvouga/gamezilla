/**
 * Build a React Navigation theme object from design-system color tokens.
 */

import {
  DarkTheme,
  DefaultTheme,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import type { ColorScheme, ColorTokens } from './theme/colors';

export function reactNavigationThemeFromTokens(
  colorScheme: ColorScheme,
  colors: ColorTokens,
): NavigationTheme {
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
    },
  };
}
