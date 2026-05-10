/**
 * One-shot wiring: preference (optional persistence) → design tokens → React Navigation theme → status bar.
 */

import { type ReactNode } from 'react';

import { AppStatusBar } from './app-status-bar';
import type { ColorScheme } from './colors';
import type { FontStacks } from './fonts';
import { NavigationThemeProvider } from './navigation-theme-provider';
import type { TextCasing } from './text-casing';
import { ThemeProvider, type ThemeProviderProps } from './theme-context';
import {
  ThemePreferenceProvider,
  useThemePreference,
  type ThemePreferenceStorage,
} from './theme-preference';
import { WebScrollbarTheme } from './web-scrollbar-theme';

export type AppThemeRootProps = {
  children: ReactNode;
  storage?: ThemePreferenceStorage;
  storageKey?: string;
  fonts?: Partial<FontStacks>;
  systemFallback?: ColorScheme;
  /**
   * When set, passed to ThemeProvider instead of the stored preference.
   * Useful for tests or builds that force a scheme.
   */
  colorScheme?: ColorScheme | 'system';
  colors?: ThemeProviderProps['colors'];
  textCasing?: TextCasing;
};

function AppThemeShell({
  children,
  fonts,
  systemFallback,
  colorSchemeProp,
  colors,
  textCasing,
}: {
  children: ReactNode;
  fonts?: Partial<FontStacks>;
  systemFallback: ColorScheme;
  colorSchemeProp?: ColorScheme | 'system';
  colors?: ThemeProviderProps['colors'];
  textCasing?: TextCasing;
}) {
  const { preference } = useThemePreference();
  const colorScheme = colorSchemeProp ?? preference;

  return (
    <ThemeProvider
      colorScheme={colorScheme}
      systemFallback={systemFallback}
      {...(fonts !== undefined ? { fonts } : {})}
      {...(colors !== undefined ? { colors } : {})}
      {...(textCasing !== undefined ? { textCasing } : {})}
    >
      <NavigationThemeProvider>
        {children}
        <AppStatusBar />
        <WebScrollbarTheme />
      </NavigationThemeProvider>
    </ThemeProvider>
  );
}

export function AppThemeRoot({
  children,
  storage,
  storageKey,
  fonts,
  systemFallback = 'light',
  colorScheme,
  colors,
  textCasing,
}: AppThemeRootProps) {
  return (
    <ThemePreferenceProvider
      {...(storage !== undefined ? { storage } : {})}
      {...(storageKey !== undefined ? { storageKey } : {})}
    >
      <AppThemeShell
        systemFallback={systemFallback}
        {...(fonts !== undefined ? { fonts } : {})}
        {...(colorScheme !== undefined ? { colorSchemeProp: colorScheme } : {})}
        {...(colors !== undefined ? { colors } : {})}
        {...(textCasing !== undefined ? { textCasing } : {})}
      >
        {children}
      </AppThemeShell>
    </ThemePreferenceProvider>
  );
}
