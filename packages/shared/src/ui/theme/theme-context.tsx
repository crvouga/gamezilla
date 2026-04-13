/**
 * Theme context and provider.
 * Resolves `colorScheme: 'system'` via React Native appearance; exposes window
 * metrics on the theme so apps avoid importing RN dimension hooks.
 */

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';
import { assert } from '../../assert';
import type { ColorScheme, ColorTokens } from './colors';
import { defaultColors } from './colors';
import { fonts } from './fonts';
import { createSx } from './sx';

export type ThemeLayout = {
  width: number;
  height: number;
  scale: number;
  fontScale: number;
};

export type Theme = {
  sx: ReturnType<typeof createSx>;
  colors: ColorTokens;
  colorScheme: ColorScheme;
  fonts: typeof fonts;
  layout: ThemeLayout;
};

const ThemeContext = createContext<Theme | null>(null);

export type ThemeProviderProps = {
  /**
   * Use `'system'` to follow the OS appearance (resolved inside the provider).
   * Pass `'light'` or `'dark'` for a fixed scheme.
   */
  colorScheme: ColorScheme | 'system';
  /**
   * When `colorScheme` is `'system'` and RN reports no preference, use this.
   */
  systemFallback?: ColorScheme;
  children: ReactNode;
  /** Optional color overrides per scheme */
  colors?: Partial<Record<ColorScheme, Partial<ColorTokens>>>;
};

export function ThemeProvider({
  colorScheme: colorSchemeProp,
  systemFallback = 'light',
  children,
  colors: colorOverrides,
}: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const layout = useWindowDimensions();

  const resolvedScheme: ColorScheme = useMemo(() => {
    if (colorSchemeProp !== 'system') {
      return colorSchemeProp;
    }
    if (systemScheme === 'dark' || systemScheme === 'light') {
      return systemScheme;
    }
    return systemFallback;
  }, [colorSchemeProp, systemScheme, systemFallback]);

  const theme = useMemo(() => {
    const base = defaultColors[resolvedScheme];
    const overrides = colorOverrides?.[resolvedScheme];
    const colors: ColorTokens = overrides ? { ...base, ...overrides } : base;

    return {
      sx: createSx(colors),
      colors,
      colorScheme: resolvedScheme,
      fonts,
      layout: {
        width: layout.width,
        height: layout.height,
        scale: layout.scale,
        fontScale: layout.fontScale,
      },
    };
  }, [resolvedScheme, colorOverrides, layout]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  assert.defined(ctx, 'ThemeContext must be defined');
  return ctx;
}
