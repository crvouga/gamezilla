/**
 * Theme context and provider.
 * Resolves `colorScheme: 'system'` via React Native appearance; exposes
 * container layout metrics on the theme so apps avoid importing RN dimension
 * hooks. Width/height come from this provider's host `onLayout` (falling back
 * to the window until the first layout) so nested roots (e.g. playground
 * panels) get correct breakpoints and modal clamps.
 */

import { assert } from '@pkgs/assert';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  type LayoutChangeEvent,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
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
  /** Current layout bucket from container (layout) width. */
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

type MeasuredSize = {
  readonly width: number;
  readonly height: number;
};

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
  const windowLayout = useWindowDimensions();
  const [measured, setMeasured] = useState<MeasuredSize | null>(null);

  const onHostLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setMeasured((prev) => {
      if (prev !== null && prev.width === width && prev.height === height) {
        return prev;
      }
      return { width, height };
    });
  }, []);

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
    const width =
      measured !== null && measured.width > 0
        ? measured.width
        : windowLayout.width;
    const height =
      measured !== null && measured.height > 0
        ? measured.height
        : windowLayout.height;

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
        width,
        height,
        scale: windowLayout.scale,
        fontScale: windowLayout.fontScale,
      },
      breakpoint: getBreakpoint(width),
      motion,
      elevation,
    };
  }, [
    resolvedScheme,
    colorOverrides,
    fontsProp,
    textCasingProp,
    measured,
    windowLayout.height,
    windowLayout.width,
    windowLayout.scale,
    windowLayout.fontScale,
  ]);

  return (
    <ThemeContext.Provider value={theme}>
      <View style={hostStyle} onLayout={onHostLayout}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

const hostStyle = {
  flex: 1,
  minHeight: 0,
  minWidth: 0,
} as const;

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  assert.defined(ctx, 'ThemeContext must be defined');
  return ctx;
}
