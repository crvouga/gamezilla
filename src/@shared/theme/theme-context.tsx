/**
 * Theme context and provider.
 * App provides colorScheme; theme package is app-agnostic.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { assertDefined } from '../assert';
import type { ColorScheme, ColorTokens } from './colors';
import { defaultColors } from './colors';
import { fonts } from './fonts';
import { createSx } from './sx';

export type Theme = {
  sx: ReturnType<typeof createSx>;
  colors: ColorTokens;
  colorScheme: ColorScheme;
  fonts: typeof fonts;
};

const ThemeContext = createContext<Theme | null>(null);

export type ThemeProviderProps = {
  colorScheme: ColorScheme;
  children: ReactNode;
  /** Optional color overrides per scheme */
  colors?: Partial<Record<ColorScheme, Partial<ColorTokens>>>;
};

export function ThemeProvider({
  colorScheme,
  children,
  colors: colorOverrides,
}: ThemeProviderProps) {
  const theme = useMemo(() => {
    const base = defaultColors[colorScheme];
    const overrides = colorOverrides?.[colorScheme];
    const colors: ColorTokens = overrides ? { ...base, ...overrides } : base;

    return {
      sx: createSx(colors),
      colors,
      colorScheme,
      fonts,
    };
  }, [colorScheme, colorOverrides]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  assertDefined(ctx, 'ThemeContext must be defined');
  return ctx;
}
