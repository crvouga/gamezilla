/**
 * Theme context and provider.
 * Resolves `colorScheme: 'system'` via React Native appearance; exposes window
 * metrics on the theme so apps avoid importing RN dimension hooks.
 */

import { assert } from '@pkgs/assert';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { StyleSheet, useColorScheme, useWindowDimensions } from 'react-native';
import { type BreakpointName, getBreakpoint } from './breakpoints';
import type { ColorScheme, ColorTokens } from './colors';
import { COLOR_PALETTE } from './colors';
import { type FontStacks, fonts } from './fonts';
import { type Motion, motion } from './motion';
import {
  type ElevationLevel,
  type ElevationStyle,
  makeElevation,
} from './scale';
import { createSx } from './sx';
import type { SxInput } from './sx-props';
import { sxToCss } from './sx-to-css';
import { defaultTextCasing, type TextCasing } from './text-casing';

export type ThemeLayout = {
  width: number;
  height: number;
  scale: number;
  fontScale: number;
};

export type Theme = {
  /** RN host compiler — only host adapters and tests should call this. */
  sx: ReturnType<typeof createSx>;
  /** CSS compiler for HTML reports / `dataSet.css` capture. */
  css: (input: SxInput) => string;
  colors: ColorTokens;
  colorScheme: ColorScheme;
  fonts: FontStacks;
  /** Global casing for {@link Text} (overridable per node via `sx` / `style`). */
  textCasing: TextCasing;
  layout: ThemeLayout;
  /** Current layout bucket from window width. */
  breakpoint: BreakpointName;
  /** Motion design tokens (durations, easings). */
  motion: Motion;
  /**
   * Scheme-aware elevation. In light mode returns shadow only; in dark mode
   * also returns the recommended `backgroundColor` lift so cards stay
   * legible without relying on shadow contrast.
   */
  elevation: (level: ElevationLevel) => ElevationStyle;
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
  /** Optional font stack overrides (merged onto defaults) */
  fonts?: Partial<FontStacks>;
  /** Overrides {@link defaultTextCasing} for all design-system `Text`. */
  textCasing?: TextCasing;
};

export function ThemeProvider({
  colorScheme: colorSchemeProp,
  systemFallback = 'light',
  children,
  colors: colorOverrides,
  fonts: fontsProp,
  textCasing: textCasingProp,
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
    const base = COLOR_PALETTE[resolvedScheme];
    const overrides = colorOverrides?.[resolvedScheme];
    const colors: ColorTokens = overrides ? { ...base, ...overrides } : base;
    const mergedFonts: FontStacks = fontsProp
      ? { ...fonts, ...fontsProp }
      : fonts;
    const textCasing = textCasingProp ?? defaultTextCasing;
    const elevation = makeElevation(colors, resolvedScheme);

    return {
      sx: createSx(colors, {
        elevation,
        hairlineWidth: StyleSheet.hairlineWidth,
      }),
      css: (input: SxInput) => sxToCss(input, { colors, elevation }),
      colors,
      colorScheme: resolvedScheme,
      fonts: mergedFonts,
      textCasing,
      layout: {
        width: layout.width,
        height: layout.height,
        scale: layout.scale,
        fontScale: layout.fontScale,
      },
      breakpoint: getBreakpoint(layout.width),
      motion,
      elevation,
    };
  }, [resolvedScheme, colorOverrides, fontsProp, textCasingProp, layout]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  assert.defined(ctx, 'ThemeContext must be defined');
  return ctx;
}
