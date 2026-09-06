/**
 * Bridges design-system theme tokens into React Navigation's ThemeProvider.
 */

import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import type { ReactNode } from 'react';

import { reactNavigationThemeFromTokens } from './navigation-theme';
import { useTheme } from './theme-context';

export type NavigationThemeProviderProps = {
  children: ReactNode;
};

export function NavigationThemeProvider({
  children,
}: NavigationThemeProviderProps) {
  const theme = useTheme();
  const navigationTheme = reactNavigationThemeFromTokens(
    theme.colorScheme,
    theme.colors
  );

  return (
    <NavThemeProvider value={navigationTheme}>{children}</NavThemeProvider>
  );
}
